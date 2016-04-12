'use strict';

var port      = 3001;
var host      = 'api.ridepedal.com';
var devHost   = 'localhost'//'api-dev.ridepedal.com';
var clients   = [];
var ioProd    = require('socket.io')(port);
var ioStaging = require('socket.io')(port + 1);
var http      = require('https');

/* LOGS SWITCH */
var pedaler_location_update = false,
    notify_nearest_pedaler  = true,
    accept_booking          = false,
    start_ride              = false,
    pedaler_cancel_booking  = false,
    update_booking_location = false,
    rider_cancel_booking    = false,
    end_ride                = false,
    create_payment          = false,
    pedaler_eta             = false,
    push_notif              = true;
/* END LOGS */

// PROD SERVER
console.log(getDateTime() + 'Websockets PRODUCTION server running on port ' + port + '...');
ioProd.on('connection', function (socket) {
  var deviceId = socket.handshake.query.deviceId;

  clients.push({
    sid: socket.id,
    deviceId: deviceId
  });

  console.log(getDateTime() + '++++++ Client ' + deviceId + ' with socket ID: "' + socket.id + '" has connected! ++++++');

  socket.on('pedaler location update', function (param) {
    param.deviceId = deviceId;
    ioProd.emit('pedaler location update', param);

    if (pedaler_location_update) {
      console.log(getDateTime() + 'Pedaler Location Update: ' + deviceId + '; Lon: ' + param.lon + '; Lat: ' + param.lat + ';');
    }
  });

  socket.on('notify nearest pedaler', function (param) {
    if (notify_nearest_pedaler) {
      console.log(getDateTime() + '----- NOTIFY PEDALER -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + '; Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '--------- PARAMS ---------');
      console.log(param);
      console.log(getDateTime() + '--- NOTIFY PEDALER END ---');
    }

    pushNotif(host, param.pedalerID, 'New ride request from ' + param.riderName, 'NewRideRequest', param.bookingID, 'pedaler', param.riderID);

    var to = param.pedalerDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('notify nearest pedaler', param);
  });

  socket.on('accept booking', function (param) {
    if (accept_booking) {
      console.log(getDateTime() + '----- ACCEPT BOOKING -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + '; Accepted by Pedaler ID: ' + param.pedalerID + ';');
      console.log(getDateTime() + '--------- PARAMS ---------');
      console.log(param);
      console.log(getDateTime() + '--- ACCEPT BOOKING END ---');
    }

    var message = 'Your pedaler is on the way, ' + param.pedalerName + ' will pick you up in 2 mins';
    var type = 'DriverOnTheirWay';
    if(param.isQRBooking === 'Yes'){
     message = param.pedalerName + ' has accepted your ride request';
     type = 'DriverAcceptRideFromQRCode';
   }
    pushNotif(host, param.riderID, message, type, param.bookingID, 'rider', param.pedalerID);

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('accept booking', param);
  });

  socket.on('start ride', function (param) {
    if (start_ride) {
      console.log(getDateTime() + '----- START RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Started by Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '------- PARAMS -------');
      console.log(param);
      console.log(getDateTime() + '--- START RIDE END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('start ride', param);
  });

  socket.on('pedaler cancel booking', function (param) {
    if (pedaler_cancel_booking) {
      console.log(getDateTime() + '----- PEDALER CANCEL RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Cancelled by Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '------------ PARAMS -----------');
      console.log(param);
      console.log(getDateTime() + '--- PEDALER CANCEL RIDE END ---');
    }

    pushNotif(host, param.pedalerID, 'You\'ve cancelled the ride with ' + param.riderName, 'DriverCancelRide' , param.bookingID, 'pedaler', param.riderID);
    pushNotif(host, param.riderID, 'Your Pedal cab had to unexpectedly cancel your ride. Please try requesting again', 'DriverCancelRide' , param.bookingID, 'rider', param.pedalerID);

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('pedaler cancel booking', param);
  });

  socket.on('update booking location', function (param) {
    if (update_booking_location) {
      console.log(getDateTime() + '----- UPDATE BOOKING LOCATION -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Updated Booking Location by Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '-------------- PARAMS -------------');
      console.log(param);
      console.log(getDateTime() + '--- UPDATE BOOKING LOCATION END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('update booking location', param);
  });

  socket.on('rider cancel booking', function (param) {
    if (rider_cancel_booking) {
      console.log(getDateTime() + '----- RIDER CANCEL RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Cancelled by Rider ID:' + param.riderID + ';');
      console.log(getDateTime() + '----------- PARAMS ----------');
      console.log(param);
      console.log(getDateTime() + '--- RIDER CANCEL RIDE END ---');
    }

    pushNotif(host, param.pedalerID, 'The passenger unfortunately had to cancel the ride', 'RiderCancelRide' , param.bookingID, 'pedaler', param.riderID);

    var to = param.pedalerDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('rider cancel booking', param);
  });

  socket.on('end ride', function (param) {
    if (end_ride) {
      console.log(getDateTime() + '----- END RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Ended by Pedaler ID:' + param.pedalerID + ', Partial Amount: ' + param.amount + ';');
      console.log(getDateTime() + '------ PARAMS ------');
      console.log(param);
      console.log(getDateTime() + '--- END RIDE END ---');
    }

    pushNotif(host, param.riderID, 'Your ride has completed, please rate your pedaler', 'RideCompleted', param.bookingID, 'rider', param.pedalerID);

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('end ride', param);
  });

  socket.on('create payment', function (param) {
    if (create_payment) {
      console.log(getDateTime() + '----- CREATE PAYMENT -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Paid: ' + param.amount + ' By Rider ID:' + param.riderID + ';');
      console.log(getDateTime() + '------ PARAMS ------');
      console.log(param);
      console.log(getDateTime() + '--- CREATE PAYMENT END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('create payment', param);
  });

  socket.on('pedaler eta', function (param) {
    if (pedaler_eta) {
      console.log(getDateTime() + '----- PEDALER ETA PARAMS -----');
      console.log(param);
      console.log(getDateTime() + '--- PEDALER ETA PARAMS END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('pedaler eta', param);
  });

  socket.on('disconnect', function () {
    clients.some(function(entry, i) {
     if (entry.sid == socket.id) {
       clients.splice(i, 1);
       console.log(getDateTime() + '------ Client ' + entry.uid + ' with socket ID: "' + socket.id + '" has disconnected! ------');
       return true;
     }
    });

    console.log(getDateTime() + '------ Client with socket ID: "' + socket.id + '" has disconnected! ------');
  });

});

// STAGING SERVER
console.log(getDateTime() + 'Websockets STAGING server running on port 3002...');
ioStaging.on('connection', function (socket) {
  var deviceId = socket.handshake.query.deviceId;

  clients.push({
    sid: socket.id,
    deviceId: deviceId
  });

  console.log(getDateTime() + '++++++ Client ' + deviceId + ' with socket ID: "' + socket.id + '" has connected! ++++++');

  socket.on('pedaler location update', function (param) {
    param.deviceId = deviceId;
    ioStaging.emit('pedaler location update', param);

    if (pedaler_location_update) {
      console.log(getDateTime() + 'Pedaler Location Update: ' + deviceId + '; Lon: ' + param.lon + '; Lat: ' + param.lat + ';');
    }
  });

  socket.on('notify nearest pedaler', function (param) {
    if (notify_nearest_pedaler) {
      console.log(getDateTime() + '----- NOTIFY PEDALER -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + '; Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '--------- PARAMS ---------');
      console.log(param);
      console.log(getDateTime() + '--- NOTIFY PEDALER END ---');
    }

    pushNotif(devHost, param.pedalerID, 'New ride request from ' + param.riderName, 'NewRideRequest', param.bookingID, 'pedaler', param.riderID);

    var to = param.pedalerDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('notify nearest pedaler', param);
  });

  socket.on('accept booking', function (param) {
    if (accept_booking) {
      console.log(getDateTime() + '----- ACCEPT BOOKING -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + '; Accepted by Pedaler ID: ' + param.pedalerID + ';');
      console.log(getDateTime() + '--------- PARAMS ---------');
      console.log(param);
      console.log(getDateTime() + '--- ACCEPT BOOKING END ---');
    }

    var message = 'Your pedaler is on the way, ' + param.pedalerName + ' will pick you up in 2 mins';
    var type = 'DriverOnTheirWay';
    if(param.isQRBooking === 'Yes'){
     message = param.pedalerName + ' has accepted your ride request';
     type = 'DriverAcceptRideFromQRCode';
   }
    pushNotif(devHost, param.riderID, message, type, param.bookingID, 'rider', param.pedalerID);

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('accept booking', param);
  });

  socket.on('start ride', function (param) {
    if (start_ride) {
      console.log(getDateTime() + '----- START RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Started by Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '------- PARAMS -------');
      console.log(param);
      console.log(getDateTime() + '--- START RIDE END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('start ride', param);
  });

  socket.on('pedaler cancel booking', function (param) {
    if (pedaler_cancel_booking) {
      console.log(getDateTime() + '----- PEDALER CANCEL RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Cancelled by Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '------------ PARAMS -----------');
      console.log(param);
      console.log(getDateTime() + '--- PEDALER CANCEL RIDE END ---');
    }

    pushNotif(devHost, param.pedalerID, 'You\'ve cancelled the ride with ' + param.riderName, 'DriverCancelRide' , param.bookingID, 'pedaler', param.riderID);
    pushNotif(devHost, param.riderID, 'Your Pedal cab had to unexpectedly cancel your ride. Please try requesting again', 'DriverCancelRide' , param.bookingID, 'rider', param.pedalerID);

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('pedaler cancel booking', param);
  });

  socket.on('update booking location', function (param) {
    if (update_booking_location) {
      console.log(getDateTime() + '----- UPDATE BOOKING LOCATION -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Updated Booking Location by Pedaler ID:' + param.pedalerID + ';');
      console.log(getDateTime() + '-------------- PARAMS -------------');
      console.log(param);
      console.log(getDateTime() + '--- UPDATE BOOKING LOCATION END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('update booking location', param);
  });

  socket.on('rider cancel booking', function (param) {
    if (rider_cancel_booking) {
      console.log(getDateTime() + '----- RIDER CANCEL RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Cancelled by Rider ID:' + param.riderID + ';');
      console.log(getDateTime() + '----------- PARAMS ----------');
      console.log(param);
      console.log(getDateTime() + '--- RIDER CANCEL RIDE END ---');
    }

    pushNotif(devHost, param.pedalerID, 'The passenger unfortunately had to cancel the ride', 'RiderCancelRide' , param.bookingID, 'pedaler', param.riderID);

    var to = param.pedalerDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('rider cancel booking', param);
  });

  socket.on('end ride', function (param) {
    if (end_ride) {
      console.log(getDateTime() + '----- END RIDE -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Ended by Pedaler ID:' + param.pedalerID + ', Partial Amount: ' + param.amount + ';');
      console.log(getDateTime() + '------ PARAMS ------');
      console.log(param);
      console.log(getDateTime() + '--- END RIDE END ---');
    }

    pushNotif(devHost, param.riderID, 'Your ride has completed, please rate your pedaler', 'RideCompleted', param.bookingID, 'rider', param.pedalerID);

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('end ride', param);
  });

  socket.on('create payment', function (param) {
    if (create_payment) {
      console.log(getDateTime() + '----- CREATE PAYMENT -----');
      console.log(getDateTime() + 'Booking ID:' + param.bookingID + ' Paid: ' + param.amount + ' By Rider ID:' + param.riderID + ';');
      console.log(getDateTime() + '------ PARAMS ------');
      console.log(param);
      console.log(getDateTime() + '--- CREATE PAYMENT END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('create payment', param);
  });

  socket.on('pedaler eta', function (param) {
    if (pedaler_eta) {
      console.log(getDateTime() + '----- PEDALER ETA PARAMS -----');
      console.log(param);
      console.log(getDateTime() + '--- PEDALER ETA PARAMS END ---');
    }

    var to = param.riderDeviceID;
    socket.broadcast.to(getSocketId(to)).emit('pedaler eta', param);
  });

  socket.on('disconnect', function () {
    clients.some(function(entry, i) {
     if (entry.sid == socket.id) {
       clients.splice(i, 1);
       console.log(getDateTime() + '------ Client ' + entry.uid + ' with socket ID: "' + socket.id + '" has disconnected! ------');
       return true;
     }
    });

    console.log(getDateTime() + '------ Client with socket ID: "' + socket.id + '" has disconnected! ------');
  });

});

// FUNCTIONS

function getSocketId(id) {
  console.log('Recipient Device: ' + id);
  for(var i = 0; i < clients.length; i++){
    if(clients[i].deviceId === id) {
      return clients[i].sid;
    }
  }
}

function pushNotif(hostType, id, message, type, bookingID, userType, user_notification_id) {
  var payload = JSON.stringify({
      'id' : id,
      'message': message,
      'type': type,
      'booking_id': bookingID,
      'user_type': userType,
      'user_notification_id': user_notification_id
  });

  if (push_notif) {
    console.log(getDateTime() + '----- PUSH NOTIF PAYLOAD -----');
    console.log(payload);
    console.log(getDateTime() + '--- PUSH NOTIF PAYLOAD END ---');
  }

  var options = {
      host: hostType,
      port: 8069,
      path: '/v1/notifications/sockets',
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
      }
  };

  var req = http.request(options, function(res) {
    if (push_notif) {
      console.log(getDateTime() + '----- PUSH NOTIF STATUS CODE -----');
      console.log(res.statusCode);
      console.log(getDateTime() + '--- PUSH NOTIF STATUS CODE END ---');
    }

    res.setEncoding('utf8');
    res.on('data', function(result) {
      if (push_notif) {
        console.log(getDateTime() + '===== > RESULT < =====');
        console.log(result)
        console.log(getDateTime() + '===== ^ RESULT ^ =====');
      }
    });
  });

  req.on('error', function(e) {
    if (push_notif) {
      console.log(getDateTime() + '===== > CATCH < =====');
      console.log(e)
      console.log(getDateTime() + '===== ^ CATCH ^ =====');
    }
  });

  req.write(payload);
  req.end();
}

function getDateTime() {
    var date  = new Date();
    var hour  = date.getHours();
    var min   = date.getMinutes();
    var sec   = date.getSeconds();
    var year  = date.getFullYear();
    var month = date.getMonth() + 1;
    var day   = date.getDate();

    hour  = (hour < 10 ? "0" : "") + hour;
    min   = (min < 10 ? "0" : "") + min;
    sec   = (sec < 10 ? "0" : "") + sec;
    month = (month < 10 ? "0" : "") + month;
    day   = (day < 10 ? "0" : "") + day;

    return "[" + year + "-" + month + "-" + day + " | " + hour + ":" + min + ":" + sec + "] ";
}
