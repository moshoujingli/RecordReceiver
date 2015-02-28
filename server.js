var express = require('express');
var app = express();
var config = require('./config').config;
var fs = require('fs');
var crypto = require("crypto");
var AWS = require('aws-sdk');
var multer  = require('multer');
var s3 = new AWS.S3();

console.log('listen')
app.get('*', function(req, res){
  res.send("Thanks for Access Moshoujingli's secret!");
  res.end();
});
app.use(multer({dest:config.tmpDir}));

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
    var s3obj = new AWS.S3({ params: {Bucket: config.bucket, Key: req.files.pkg.originalname } });

    s3obj.upload({Body: body}).
      on('httpUploadProgress', function(evt) { console.log(evt); }).
      send(function(err, data) { callback(err, data) });

}

app.post('/receive',function(req,res) {
    res.status(401);
    if (req.headers && timeValidate(req.headers.time)) {
        //req.headers.hash hash=sha1(key+filesha1+time+random)
        //req.headers.time
        //req.headers.sha1
        //req.headers.random
        var info = [config.key,req.headers.sha1,req.headers.time,req.headers.random].join(':');
        var sha256 = crypto.createHash("sha256");sha256.update(info, "utf8");
        var digest = sha256.digest("base64");
        console.log(info+':'+digest)
        if(req.headers.hash!=digest){
            res.status(401).end('bad digest');
            return;
        }
        console.log(req.files)
        fileValidate(req.files.pkg.path,req.headers.sha1,function  (err,data) {
            if (err) {
                res.end()
            }else{
                storeInfo(req,function  (err,data) {
                    if (err) {
                        console.log(err)
                        res.end(err.message)
                    } else{
                        console.log('ok')
                        fs.unlink(req.files.pkg.path)
                        res.status(200).end('OK')
                    }
                });
            }
        });
    }else{
        res.end('time error');
    }
});
console.log(app.routes)
var server = app.listen(config.port, function() {
    console.log('Listening on port %d', server.address().port);
});
console.log('listened')