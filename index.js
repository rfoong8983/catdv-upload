var fs = require("fs");
var path = require("path");
var https = require("https");
var url = require("url");
var catdv = require("catdv");
var URL = url.URL;
/*---- SET THESE PARAMETERS AS APPROPRIATE --*/
var CATDV_SERVER_HOST = "";
var CATDV_SERVER_PORT = 0;

// use api user and pass here
var REST_USER = "";
var REST_PASSWORD = "";

// use for debugging
var LOG_REQUESTS=true;
/*-------------------------------------------*/
function uploadFile(filePath, fileSize, uploadURL, uploadSession, callback) {
    var ticket = uploadSession.ticket;
    var url = new URL(uploadURL);
    var maxChunkSize = Math.max(Math.min(Math.ceil(fileSize / 100), 65535 * 1024), 64 * 1024);
    var bytesUploaded = 0;
    var fd = fs.openSync(filePath, "r");
    var buffer = new Buffer(maxChunkSize);
    var sendChunk = function () {
        var chunkSize = fs.readSync(fd, buffer, 0, buffer.length, null);
        if (chunkSize > 0) {
            var requestSpec = {
                method: "PUT",
                hostname: url.hostname,
                port: Number(url.port),
                path: url.pathname + url.search,
                headers: {
                    "CatDV-Client": "PPRO",
                    "User-Agent": "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-GB; rv:1.9.2.13) Gecko/20101203 Firefox/3.6.13 (.NET CLR 3.5.30729)",
                    "Content-Type": 'application/octet-stream',
                    "Content-Length": chunkSize
                }
            };

            console.log('\n\nbytes uploaded: ', bytesUploaded);
            console.log('filePath: ', filePath);
            console.log('fileSize: ', fileSize);
            console.log('maxChunkSize: ', maxChunkSize);
            console.log('chunkSize: ', chunkSize);
            console.log('\n\nsending request...');

            var req = https.request(requestSpec, function (res) {
                if (res.statusCode == 200) {
                    console.log('STATUS: ' + res.statusCode);
                    var jsonReply = "";
                    res.on('data', function (chunk) {
                        console.log('DATA: ', chunk);
                        jsonReply += chunk;
                    });
                    res.on('end', function () {
                        var reply = JSON.parse(jsonReply);

                        if (reply.status == "OK") {
                            var uploadSession = reply.data;
                            // The transfer is complete - send the next chunk
                            bytesUploaded += chunkSize;
                            console.log("chunkSize=" + chunkSize + ", bytesUploaded=" + bytesUploaded + ", server.bytesUploaded: " + uploadSession.bytesUploaded);
                            var progressValue = Math.round(bytesUploaded * 100 / fileSize);
                            callback("PROGRESS", "Uploaded " + bytesUploaded + " of " + fileSize + "(" + progressValue + "%)", bytesUploaded, fileSize);
                            sendChunk();
                        }
                        else {
                            callback("ERROR", "Error: " + reply.errorMessage);
                        }
                    });
                }
                else {
                    callback("ERROR", "Error: " + res.statusCode);
                }
            });
            req.on('error', function (e) {
                callback("ERROR", "ERROR:" + e + " url:" + url);
            });

            console.log('\nwriting buffer to request...\n');

            req.write(buffer.slice(0, chunkSize));

            console.log('request: ', req.body);

            req.end();
        }
        else {
            callback("DONE", "Upload complete");
        }
    };

    sendChunk();
}
var filePath = "/Users/rfoong/ted/catdv-upload/audio.mp4";
var filename = path.basename(filePath);
console.log('\n\nfilename: ', filename);
var fileSize = fs.statSync(filePath).size;
console.log('\n\nfileSize: ', fileSize);
var $catdv = new catdv.RestApi(CATDV_SERVER_HOST, CATDV_SERVER_PORT, LOG_REQUESTS);

try {
    console.log('logging in...\n\n')
    $catdv.login(REST_USER, REST_PASSWORD);
} catch (e) {
    console.log('ERROR: ', e.message);
}

try {
    console.log('initiating upload session...\n\n')
    var uploadSession = $catdv.initiateUpload(filename, fileSize, {});
} catch (e) {
    console.log('ERROR: ', e.message);
}

console.log('uploadSession: ', uploadSession);

try {
    console.log('getting API URL...\n\n')
    var uploadURL = $catdv.getApiUrl("uploads/" + uploadSession.ticket);
} catch (e) {
    console.log('ERROR: ', e.message);
}

console.log('api URL: ', uploadURL);

uploadFile(filePath, fileSize, uploadURL, uploadSession, function (status, message, written, total) {
    console.log("\n\nstatus: " + status)
    console.log("message: " + message);
    if ((status == "DONE") || (status == "ERROR")) {
        $catdv.logout();
    }
});
//# sourceMappingURL=upload_media.js.map