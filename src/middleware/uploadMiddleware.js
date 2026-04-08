const multer = require("multer");

const storage = multer.memoryStorage({

 destination:(req,file,cb)=>{
   cb(null,"/");
 },

});

const upload = multer({
  storage: storage,
  limits: {fileSize: 1024 * 1024 * 20},
});

module.exports = upload;