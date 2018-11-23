var express = require('express');
var session = require('express-session');
var router = express.Router();
var path = require('path');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.set('views', path.join(__dirname, 'pug'));
app.set('view engine', 'pug');

app.use(express.static('public'));
app.use('/scripts', express.static('node_modules'));

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(function(req,res,next){
    res.locals.session = req.session;
    next();
});

app.use('/', function(req, res, next){
  res.render('index');
});

var room_list = new Set();
var directMsg = {};
io.on('connection', function(socket){
  console.log('attempting');
  var userType = socket.handshake.query['userType'];
  if(userType=='host') {
    console.log('host connected');
    var room = 'ABCD';//generateRoom(); 
    socket.on('create', function (hostKey) {
      console.log("emit recieved: " + hostKey);
      room_list.add(room);
      socket.join(room);
      socket.emit('room code', { code: room });
    });
    socket.on('direct', function(json) {
        console.log(json);
        directMsg[json.session_id]=json;
        io.to(json.socket_id).emit('system', json);
    });
    socket.on('disconnect', function(){
      console.log('host disconnected');
      io.to(room).emit('chat message','Host left room');
      io.of('/').in(room).clients(function(error, clients) {
        if (clients.length > 0) {
          clients.forEach(function (socket_id) {
            io.sockets.sockets[socket_id].leave(room);
          });
        }
      });
      room_list.delete(room);
    });
  } else {
    var room = socket.handshake.query['roomKey'];
    var name = socket.handshake.query['name'];
    var session_id = socket.handshake.query['session_id'];
    console.log("new user: "+session_id);
    if(room && room_list.has(room)) {
      socket.join(room);
      socket.session_id = session_id;
      var data = {
          name : name,
          id : socket.id,
          session_id : session_id,
      };
      io.to(room).emit('system', data);
      if(directMsg[session_id]) {
        io.to(socket.id).emit('system', directMsg[session_id]);
      }
      socket.on('control', function(msg){
        var data = {
          name : name,
          id : socket.id,
          session_id : session_id,
          payload : msg,
        };
        io.to(room).emit('control', data);
      });
    } else {
      console.log('User not joined with '+room);
    }
  }
})


function generateRoom() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789";

  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

http.listen(3000, function(){
  console.log('listening on *:3000');
});
