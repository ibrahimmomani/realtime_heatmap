var express = require('express');
var nconf = require('nconf');
var _ = require('lodash');
var Twit = require('twit');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.io  = io;

var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

//Setup rotuing for app
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});



/*============================================================ 
      TWITTER DATA
==============================================================*/
nconf.file({ file: 'config.json' }).env();

var twitter = new Twit({
  consumer_key: nconf.get('TWITTER_CONSUMER_KEY'),
  consumer_secret: nconf.get('TWITTER_CONSUMER_SECRET'),
  access_token: nconf.get('TWITTER_ACCESS_TOKEN'),
  access_token_secret: nconf.get('TWITTER_ACCESS_TOKEN_SECRET')
});

var locationSearch = 'Amman';
var oldSearchLocation;
var worldSearch;


io.on('connection', function (socket) {
  socket.on('locationSearchTerm', function (track){
    
    locationSearch = track.search;

    if (oldSearchLocation !== locationSearch) {
      oldSearchLocation = locationSearch;
      console.log('currently searching: ' + locationSearch);
    }
  });

  socket.on('worldSearchChecked', function (check) {
    worldSearch = check;
  });
});

// attach to filter stream
var tweetStream = twitter.stream('statuses/filter', { locations: '-180,-90,180,90' });

// on tweet
tweetStream.on('tweet', function (tweet) {
 // check that tweet has geo
  if (tweet.geo) {
      if(worldSearch){
        //console.log(tweet.user.name+': '+tweet.text);
        var outputPoint = {"lat": tweet.geo.coordinates[0],"lng": tweet.geo.coordinates[1]};
        io.sockets.emit('twitter-stream', {
          outputPoint: outputPoint,
          user: tweet.user.screen_name,
          text: tweet.text,
          avatar: tweet.user.profile_image_url_https
        });

      }else{
          if(tweet.hasOwnProperty('place') && tweet.place !== null) {
            if (tweet.place.hasOwnProperty('name')){
              if (tweet.place.name === locationSearch) {
                console.log(tweet.place.name);
                //console.log(tweet.user.name+': '+tweet.text);
                var outputPoint = {"lat": tweet.geo.coordinates[0],"lng": tweet.geo.coordinates[1]};
                io.sockets.emit('twitter-stream', {
                  outputPoint: outputPoint,
                  user: tweet.user.screen_name,
                  text: tweet.text,
                  avatar: tweet.user.profile_image_url_https
                });
              }
            }
          }

          else if(tweet.hasOwnProperty('place') && tweet.place !== null){
            if(tweet.place.bounding_box === 'Polygon'){
              if (tweet.place.name === locationSearch) {
                // Calculate the center of the bounding box for the tweet
                var coord, _i, _len;
                var centerLat = 0;
                var centerLng = 0;

                for (_i = 0, _len = coords.length; _i < _len; _i++) {
                  coord = coords[_i];
                  centerLat += coord[0];
                  centerLng += coord[1];
                }
                centerLat = centerLat / coords.length;
                centerLng = centerLng / coords.length;

                // Build json object and broadcast it
                var outputPoint = {"lat": centerLat,"lng": centerLng};
              io.sockets.emit('twitter-stream', {
                  outputPoint: outputPoint,
                  user: tweet.user.screen_name,
                  text: tweet.text,
                  avatar: tweet.user.profile_image_url_https
                });
              }
            }   
          }
      }//else
  } //tweet.geo

    if(worldSearch){
      io.sockets.emit('currentlySearching', 'Everywhere')
    }else{
      io.sockets.emit('currentlySearching', locationSearch)
    }

});//tweetStream


app.get('/', function (req, res) { 
  res.sendfile(__dirname + 'index.html');
});

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

module.exports = app;
