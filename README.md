## PlayByTurn
A very simple web interface to allow people to add links to a global playlist, 
intended for use by small groups on a local network, hacked together in a few 
hours. Don't expect too much of it.

## Command line parameters
**--playpassword**: Set a password to protect the play page with.

## Setting it up
Download youtube-dl, place it in the same directory and make it executable. 
Then just start index.js with NodeJS (usually by running "node index.js") and 
point people's browsers to port 3000 of your internal IP address. Also, make 
sure everyone is on the same network.

## Why download youtube-dl?
The version in your repository is most likely too out of date to work properly, 
as YouTube and many other sites it supports change all the time. If you are 
sure your version is up-to-date enough, feel free to make a symbolic link 
instead.

## License
GNU AGPLv3+
