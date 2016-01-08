"use strict";
var fs = require('fs');
var os = require('os');
var proc = require('child_process');

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var playLists = {};
var currentPlayer;
var currentSong;

// Save played songs and randomly play them when we run out
var playedSongs = [];

var options = {};

process.argv.slice(2).forEach(function (value) {
    if (value.indexOf("--") === 0) {
        value = value.split("=")
        options[value[0].slice(2)] = value[1];
    };
});

try {
    fs.mkdirSync('downloads');
} catch (e) {
    if (e.code !== 'EEXIST') {
        throw e;
    }
}

var sendCurrentSong = function () {
    console.log("Sending song");
    io.sockets.emit('newSong', {url: currentSong});
};

var nextSong = function () {
    if (Object.keys(playLists).length === 0) {
        console.log("No songs possible. Nothing has been added yet.");
        return;
    }

    if (playLists[currentPlayer] && playLists[currentPlayer].length >= 1) {
        playedSongs.push(playLists[currentPlayer].shift());
    }

    var tries = 0;
    var currentIndex;
    while (tries < Object.keys(playLists).length) {
        currentIndex = Object.keys(playLists).indexOf(currentPlayer);

        if (currentIndex === -1 || Object.keys(playLists).length === currentIndex + 1) {
            currentIndex = 0;
        } else {
            currentIndex += 1;
        }

        currentPlayer = Object.keys(playLists)[currentIndex];

        if (playLists[currentPlayer] && playLists[currentPlayer].length >= 1) {
            currentSong = playLists[currentPlayer][0];
            sendCurrentSong();
            return;
        }

        tries += 1;
    }

    console.log("No songs in queue");
    if (playedSongs.length > 0) {
        console.log("Grabbing random song from backlog");
        currentSong = playedSongs[Math.floor(Math.random() * playedSongs.length)];
        sendCurrentSong();
        return;
    }
};

io.on('connection', function (socket) {
    console.log("New connection");
    if (currentSong) {
        sendCurrentSong();
    } else {
        nextSong(false);
    }

    socket.on('songEnd', function () {
        console.log("Song ended");
        nextSong(true);
    });
});

app.get('/', function (ignore, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/currentFile', function (ignore, res) {
    res.sendFile(__dirname + '/downloads/' + currentSong.split('/').join('_') + '.ogg', function(err) {
        if (!err) {
            return;
        }
        console.log(currentSong + " cannot be sent. Skipping.");

        var index = playedSongs.indexOf(currentSong);

        // Remove song from previous playlist if it exists
        if (index != -1) {
            playedSongs.splice(index, 1);
        }

        nextSong(true);
    });
});

app.get('/play', function (req, res) {
    if (options.playpassword !== undefined) {
        if (req.query.pass === undefined) {
            res.send('Password required. Please add ?pass= followed by the password to the end of this URL.');
            return;
        }

        if (req.query.pass !== options.playpassword) {
            res.send('Incorrect password.');
            return;
        }
    }
    res.sendFile(__dirname + '/play.html');
});

app.get('/add', function (req, res) {
    if (!req.query.url) {
        res.send('Cannot add empty URL');
        return;
    }

    var user = req.connection.remoteAddress;

    if (playLists[user] === undefined) {
        playLists[user] = [];
    }

    var filename = req.query.url.split('/').join('_');

    var addDone = function () {
        console.log("Adding of %s completed", req.query.url);
        if (!currentSong) {
            console.log("Nothing playing. Forcing next song");
            nextSong(false);
        }
    };

    fs.lstat('downloads/' + filename + '.ogg', function (err) {
        if (err && err.code === 'ENOENT') {
            console.log("%s doesn't exist, will download", req.query.url);
            var command = proc.spawn('./youtube-dl', [req.query.url, '--extract-audio', '--audio-format=vorbis', '-o', 'downloads/' + req.query.url.split('/').join('_') + '.ogg']);
            command.on('exit', function (code) {
                if (code !== 0) {
                    res.send("Failed to add " + req.query.url + ": Error code " + code);
                    console.log("Failed to add %s: Error code %s", req.query.url, code);
                    return;
                }

                res.send("Link downloaded and added.");
                playLists[user].push(req.query.url);
                addDone();
            });
        } else {
            res.send("Link queued from cache.");
            console.log("File in cache");
            playLists[user].push(req.query.url);
            addDone();
        }
    });
});

server.listen(3000, function () {
    var networkInterfaces = os.networkInterfaces();
    Object.keys(networkInterfaces).forEach(function (networkInterface) {
        networkInterface = networkInterfaces[networkInterface];
        Object.keys(networkInterface).forEach(function (interfaceEntry) {
            console.log('PlayByTurn listening at http://%s:3000', networkInterface[interfaceEntry].address);
        });
    });
});
