var express = require('express');
var app = express();
var config = require('./config');
var fs = require('fs');
var crypto = require("crypto");
var AWS = require('aws-sdk'); 

var s3 = new AWS.S3();

app.use(express.bodyParser({ keepExtensions: true, uploadDir:  }));
app.get('/', function(req, res){
  res.send("Thanks for Access Moshoujingli's secret!");
});
app.use(express.bodyParser({ keepExtensions: true, uploadDir: config.tmpDir }));

function timeValidate (timestamp) {
	var currMilli = (new Date()).getTime();
	return (timestamp<currMilli && (currMilli - timestamp)<300*1000 ) ;
}

function fileValidate (filePath,digest,callback) {
	var shasum = crypto.createHash('sha1');
	var s = fs.ReadStream(filePath);
	s.on('data', function(d) {
	  shasum.update(d);
	});

	s.on('end', function() {
	  var d = shasum.digest('hex');
	  if (d==digest) {
	  	callback()
	  } else{
	  	callback('bad file');
	  };
	});
}
function storeInfo (req,callback) {
	//move file to s3
	var body = fs.createReadStream(req.files.pkg.path);
	var s3obj = new AWS.S3({ params: {Bucket: config.bucket, Key: req.files.pkg} });

	s3obj.upload({Body: body}).
	  on('httpUploadProgress', function(evt) { console.log(evt); }).
	  send(function(err, data) { callback(err, data) });

}

app.post('/receive',function(req,res) {
	if (req.meta && timeValidate(req.meta.time)) {
		//req.meta.hash hash=sha1(key+filesha1+time+ramdon)
		//req.meta.time
		//req.meta.sha1
		//req.meta.ramdon
		var info = [config.key,req.meta.sha1,req.meta.time,req.meta.ramdon].join(:);
		var sha256 = crypto.createHash("sha256");sha256.update(info, "utf8");
		var digest = sha256.digest("base64");
		if(req.meta.hash!=digest){
			res.end();
			return;
		} 
		fileValidate(req.files.pkg.path,req.meta.sha1,function  (err,data) {
			if (err) {
				res.end()
			}else{
				storeInfo(req,function  (err,data) {
					if (err) { res.end(err) } else{ res.end('OK') };
				});
			}
		})

	}
});

app.listen(config.port);