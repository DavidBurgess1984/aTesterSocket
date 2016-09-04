var express = require('express'),
    http = require('http');
//make sure you keep this order
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var mysql = require("mysql");
server.listen(3000, function() {
    console.log('listening...');
});
var con = mysql.createConnection({
    host: "localhost",
    user: "david",
    password: "access",
    database: "AppTester"
});

var roomName; 
io.on('connection', function(socket) {
    console.log('connection...');
    //var handshakeData = socket.request;
    //console.log(handshakeData._query);
    // var userID = handshakeData._query['userID'];
    //var projectID = handshakeData._query['projectID'];
    socket.on('userInfo', function(data) {
        var query = 'SELECT ' +
            ' uc.ucIdCollaboration AS `idCollaboration` ' +
            ' FROM ' + ' UserCollaboration uc ' +
            ' INNER JOIN ' + ' Collaboration c ' + ' ON ' +
            ' c.idCollaboration = uc.ucIdCollaboration ' +
            ' WHERE c.cIdProject = ' + con.escape(data.projectID) +
            ' AND uc.ucIdUser = ' + con.escape(data.userID) + ' LIMIT 0,1 ';

        con.query(query, function(err, rows) {
            if(err) throw err;
            var collaboration = rows[0].idCollaboration;
            
            roomName = 'collaboration' + collaboration;
            socket.join(roomName);
            console.log('socket joined room: ' + roomName);
            //console.log(io.sockets.clients('roomName')+'\n');
        });
    });
    
    //update Testsheet response
    socket.on('updateResponse', function(data){
       var query = " UPDATE Response SET rContent = "+con.escape(data.newResponse) +" WHERE idResponse=" +con.escape(data.responseID);
       
       con.query(query, function(err, rows) {
            if(err) throw err;
            var dataresp = {'success' : true, responseID: data.responseID, newResponse:data.newResponse};
            io.sockets.in(roomName).emit('modifyResponse', dataresp);
        });
    });
    
    //delete testsheet response
    socket.on('deleteResponse',function(data){
        
        var query = " DELETE FROM Response WHERE idResponse = "+ con.escape(data.responseID);
        //console.log(query);
        
        con.query(query, function(err, rows) {
            if(err) throw err;
            
            var responseID = data.responseID;
            var dataresp = {"responseID": responseID};
            io.sockets.in(roomName).emit('removeResponse', dataresp);
        });
    });
    
    socket.on('deleteTestsheet', function(data){
        
        con.beginTransaction(function(err){
            var query = " DELETE FROM Response "+
                   " WHERE rIdTestsheetQuestion " +
                   " IN " +
                   " (SELECT idTestSheetQuestion " +
                   " FROM TestSheetQuestion WHERE tsqIdTestsheet = "+con.escape(data.testsheetID) + " )";
       
            con.query(query, function(err, rows) {
                 if (err) {
                    return con.rollback(function() {
                      throw err;
                    });
                  }
                  
                  var tsquery = " DELETE FROM TestSheetQuestion WHERE tsqIdTestsheet = "+con.escape(data.testsheetID);
                    //console.log(tsquery);
                    con.query(tsquery, function(err, rows){
                        if (err) {
                            return con.rollback(function() {
                              throw err;
                            });
                          }
                          
                         var deleteTestSheetQuery = "DELETE FROM TestSheet WHERE idTestSheet = "+con.escape(data.testsheetID);
                        //console.log(deleteTestSheetQuery);
                         con.query(deleteTestSheetQuery, function(err, rows) {
                             if (err) {
                                return con.rollback(function() {
                                  throw err;
                                });
                              }
                              
                              con.commit(function(err) {
                                if (err) {
                                  return con.rollback(function() {
                                    throw err;
                                  });
                                }
                                var dataresp = {'success' : true, testsheetID: data.testsheetID};
                                //console.log(dataresp);
                                //console.log(roomName);
                                io.sockets.in(roomName).emit('removeTestsheet', dataresp);
                                console.log('success!');
                              });
                             
                         }); 
                    });
            });
            
        });
       
    });     
            
           
    
    socket.on('createResponse', function(data){
        
        //console.log(data);
        var query = "INSERT INTO Response (rContent, rIdUser,rIdTestSheetQuestion,rDateInserted, rOrder) "+
                "SELECT "+con.escape(data.response) + ", "+con.escape(data.userID) + " , "+con.escape(data.testsheetQuestionID) + " , NOW(),IFNULL(MAX(rOrder)+1,1) FROM Response WHERE rIdTestSheetQuestion = "+con.escape(data.testsheetQuestionID);
        
        //console.log(query);
        
        con.query(query, function(err, rows) {
            if (err) throw err;
            
            var dataresp = {};
			dataresp['userID'] = data.userID;
            dataresp['user_email'] = data.user_email;
            dataresp['response'] = data.response;
            dataresp['id'] = rows.insertId;
            dataresp['input'] = data.input;
            dataresp['testQuestionID'] = data.testsheetQuestionID;
            //var collaboration = 'collaboration' + data.collaboration;
            io.sockets.in(roomName).emit('resolveNewResponse', dataresp);
        });
    });
    socket.on('updateTestsheetDescription', function(data){
        
        //console.log(data.newTestsheetTitle);
        
       var query = " UPDATE TestSheet SET tsTitle = "+ con.escape(data.newTestsheetTitle) + " WHERE idTestsheet = "+ con.escape(data.testsheetID);
       
       con.query(query, function(err, rows) {
            if (err) throw err;
            
            var dataresp = {};
            dataresp['testsheetID'] =data.testsheetID;
            dataresp['newTestsheetTitle'] = data.newTestsheetTitle;
            //var collaboration = 'collaboration' + data.collaboration;
            io.sockets.in(roomName).emit('resolveNewTestsheetName', dataresp);
        });
    });
    socket.on('updateProjectDescription', function(data) {
        //console.log(data);
        var query =
            "UPDATE Project p JOIN Collaboration c ON p.idProject = c.cIdProject " +
            "SET p.pDeadline = " + con.escape(data.deadline) +
            " WHERE p.idProject = " + con.escape(data.projectID);
        con.query(query, function(err, rows) {
            if(err) throw err;
            var collaboration = 'collaboration' + data.collaboration;
            io.sockets.in(roomName).emit(
                'updateProjDesc', data);
        });
    });
    
	socket.on('updateQuestionStatus', function(data) {
        //console.log(data);
		
		var isCheckedNum = data.isChecked ? 1 : 0;
		
        var query =
            "UPDATE TestSheetQuestion " +
            "SET tsqStatus = " + isCheckedNum +
            " WHERE tsqIdQuestion = " + con.escape(parseInt(data.testsheetQuestionID));
        con.query(query, function(err, rows) {
            if(err) throw err;
            var collaboration = 'collaboration' + data.collaboration;
            io.sockets.in(roomName).emit(
                'updateQuestionStatus', data);
        });
    });
	
    socket.on('createTestsheet', function(data) {
        //console.log(data.testsheetType);
        
        switch(data.testsheetType){
            case 'smartphone' :
                var testsheetType = 1;
                break;
            default:
                var testsheetType =255;
                break;
        }
        
        
        var query =
            " INSERT INTO TestSheet(tsIdTestsheetTemplate,tsTitle,tsDateInserted,tsIdProject,tsStatus)"+
            " VALUES ( "+ con.escape(testsheetType)+ ", "+con.escape(data.testsheetTitle)+", NOW(), "+ con.escape(data.projectID) + " ,0)";

        con.query(query, function(err, result) {
            if (err) throw err;
            
            var testsheetID = result.insertId;
            var title = data.testsheetTitle;
            
            //console.log(testsheetID);
            var newQuery = "INSERT INTO TestSheetQuestion" 
                    +" (tsqIdQuestion,tsqStatus,tsqDateInserted,tsqIdTestSheet)" 
                +" SELECT idQuestion, 0,NOW(),"+ con.escape(testsheetID)+" FROM Question"
            
            con.query(newQuery, function(err, result) {
                if (err) throw err;
                var dataResp = {
                    "testsheetTitle": title,
                    "testsheetID": testsheetID
                }
            
                io.sockets.in(roomName).emit('sendMessageNewTestsheet', dataResp);
            });
            
        });
    });
});
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});