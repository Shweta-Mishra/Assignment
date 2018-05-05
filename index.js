
var Express = require('express');
var bodyParser = require('body-parser');
var promise = require('promise');
var app = Express();
var server = app.listen(3000);
var io = require('socket.io').listen(server);

var totalRequest = {}, totalRequestNo=0;
var activeRequest = {}, hrRequest = [], minuteRequest = {};
var totalExec =0,starttime="";

var checkHrRequest = function(){
	console.log("hr function");
	return new promise(function(resolve,reject){
		var now = new Date(); var resptime =0;
		var aMinuteAgo = now - (1000 * 60);
		var cnt = 0;
		for (var i = hrRequest.length - 1; i >= 0; i--) {
			if (hrRequest[i].start >= aMinuteAgo) {
				++cnt;
				if(minuteRequest.hasOwnProperty(hrRequest[i].method))
					minuteRequest[hrRequest[i].method] = minuteRequest[hrRequest[i].method] +1;
				else
					minuteRequest[hrRequest[i].method] = 1;
				resptime = resptime +(hrRequest[i].end - hrRequest[i].start);
			} else {
				hrRequest.splice(0, i);
				break;
			}
		}
		console.log("length is "+hrRequest.length);
		minuteRequest.count = cnt;
		minuteRequest.resptime = resptime/cnt;
		resolve();
	});
};

app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({limit: '50mb'}));

/*FOR TESTINF FOR ALLOWING SAME ORIGIN REQUEST*/
app.all('*', function(req, res,next) {
    /**
     * Response settings
     * @type {Object}
     */
    var responseSettings = {
        "AccessControlAllowOrigin": req.headers.origin,
        "AccessControlAllowHeaders": "Content-Type,X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5,  Date, X-Api-Version, X-File-Name",
        "AccessControlAllowMethods": "POST, GET, PUT, DELETE, OPTIONS",
        "AccessControlAllowCredentials": true
    };

    /**
     * Headers
     */
    res.header("Access-Control-Allow-Credentials", responseSettings.AccessControlAllowCredentials);
    res.header("Access-Control-Allow-Origin",  responseSettings.AccessControlAllowOrigin);
    res.header("Access-Control-Allow-Headers", (req.headers['access-control-request-headers']) ? req.headers['access-control-request-headers'] : "x-requested-with");
    res.header("Access-Control-Allow-Methods", (req.headers['access-control-request-method']) ? req.headers['access-control-request-method'] : responseSettings.AccessControlAllowMethods);

    if ('OPTIONS' == req.method) {
        res.send(200);
    }
    else {
        next();
    }
  

});


/*
*this is used to count all the incoming request 
*but not required if we don't want to count request for /stats
*comment app.all(*) and copy lines in /process/* end point to count 
*request to /process/* only
*/
app.all('*',function(req,res,next){
	starttime = new Date();
	totalRequestNo++;
	if (totalRequest.hasOwnProperty(req.method))
		totalRequest[req.method] = totalRequest[req.method]+1;
	else
		totalRequest[req.method] = 1;
		
	if (activeRequest.hasOwnProperty(req.method))
		activeRequest[req.method] = activeRequest[req.method]+1;
	else
		activeRequest[req.method] = 1;
		
	io.emit('active',activeRequest);
	next();
});

app.all('/process/*',function(req,res){
	var responsejson = {};
	//responsejson.time = new Date();
	responsejson.time = starttime;
	responsejson.method = req.method;
	responsejson.headers = req.headers;
	responsejson.path = req.url;
	responsejson.query = req.query;
	responsejson.body = req.body;
	responsejson.duration = Math.floor(Math.random() * 15) + 15;
	
	setTimeout(function(){
		activeRequest[req.method] = activeRequest[req.method]-1;
		console.log("diff is "+(new Date() - responsejson.time));
		totalExec = totalExec + (new Date() - responsejson.time);
		hrRequest.push({'start':responsejson.time, 'end': new Date(),'method':req.method});
		io.emit('totalrequest',totalRequest);
		checkHrRequest().then(function(){io.emit('min',minuteRequest);});
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(responsejson));
	},responsejson.duration*1000);
	
});

app.all('/stats',function(req,res){
	//start = new Date();
	var resjson = {};
	resjson.totalRequest = totalRequest;
	/*Comment next line if don't want to count stats*/
	activeRequest[req.method] = activeRequest[req.method]-1;
	resjson.activeRequest = activeRequest;
	/*Comment next line if don't want to count request for stats*/
	hrRequest.push({'start':starttime, 'end': new Date(),'method':req.method});
	checkHrRequest().then(function(){console.log("resolved");});
	resjson.minuteRequest = minuteRequest;
	/*comment next line if don't want to count request for stats*/
	totalExec = totalExec + (new Date() - starttime);                             
	resjson.totalRequest.responsetime = totalExec/totalRequestNo;
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(resjson));
});
