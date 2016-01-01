var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var os = require('os')
var fs = require('fs')
var proc = require('child_process');

var playLists = {};
var currentPlayer;

// Save played songs and randomly play them when we run out
var playedSongs = [];

var currentSong;

try {
  fs.mkdirSync('downloads');
} catch (e) {
  if ( e.code != 'EEXIST' ) throw e;
}

var sendCurrentSong = function() {
  console.log("Sending song");
  io.sockets.emit('newSong', { url: currentSong });
};

var nextSong = function(removeSong) {
  if (Object.keys(playLists).length == 0) {
    console.log("No songs possible. Nothing has been added yet.")
    return;
  };

  if (playLists[currentPlayer] && playLists[currentPlayer].length >= 1) {
    playedSongs.push(playLists[currentPlayer].shift());
  };

  for (tries = 0; tries < Object.keys(playLists).length; tries++) {
    currentIndex = Object.keys(playLists).indexOf(currentPlayer);

    if (currentIndex == -1 || Object.keys(playLists).length == currentIndex + 1) {
      currentIndex = 0;
    } else {
      currentIndex++;
    };

    currentPlayer = Object.keys(playLists)[currentIndex];

	if (playLists[currentPlayer] && playLists[currentPlayer].length >= 1) {
      currentSong = playLists[currentPlayer][0];
      sendCurrentSong();
      return;
    };
  };

  console.log("No songs in queue");
  if (playedSongs.length > 0) {
    console.log("Grabbing random song from backlog");
    currentSong = playedSongs[Math.floor(Math.random() * playedSongs.length)];
    sendCurrentSong();
    return;
  };
};

io.on('connection', function (socket) {
  console.log("New connection");
  if (currentSong) {
    sendCurrentSong();
  } else {
    nextSong(false);
  }

  socket.on('songEnd', function (data) {
    console.log("Song ended");
    nextSong(true);
  });
});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/currentFile', function (req, res) {
  res.sendFile(__dirname + '/downloads/' + currentSong.split('/').join('_') + '.ogg');
});

app.get('/play', function (req, res) {
  res.sendFile(__dirname + '/play.html');
});

app.get('/add', function(req, res) {
  if (!req.query.url) {
    res.send('Cannot add empty URL');
    return;
  };

  var user = req.connection.remoteAddress;

  if ( !(user in playLists) ) {
    playLists[user] = [];
  };

  var filename = req.query.url.split('/').join('_');

  var addDone = function() {
    console.log("Adding of %s completed", req.query.url);
    if (!currentSong) {
      console.log("Nothing playing. Forcing next song");
      nextSong(false);
    };
  };

  fs.lstat('downloads/' + filename + '.ogg', function(err, stats) {
    if (err && err.code == 'ENOENT') {
      console.log("%s doesn't exist, will download", req.query.url);
      var command = proc.spawn('./youtube-dl', [req.query.url, '--extract-audio', '--audio-format=vorbis', '-o', 'downloads/' + req.query.url.split('/').join('_') + '.ogg']);
      command.on('exit', function( code, signal ) {
        if (code != 0) {
          res.send("Failed to add " + req.query.url + ": Error code " + code);
          console.log("Failed to add %s: Error code %s", req.query.url, code);
          return;
        };
        res.send("Link downloaded and added.");
        playLists[user].push(req.query.url);
        addDone();
      });
    } else {
      res.send("Link queued from cache.");
      console.log("File in cache");
      playLists[user].push(req.query.url);
      addDone();
    };
  });
});

server.listen(3000, function () {
  var networkInterfaces = os.networkInterfaces();
  for (networkInterface in networkInterfaces) {
    var networkInterface = networkInterfaces[networkInterface];
    for (interfaceEntry in networkInterface) {
      console.log('PlayByTurn listening at http://%s:3000', networkInterface[interfaceEntry].address);
    };
  };
});
