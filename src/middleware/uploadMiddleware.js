const multer = require("multer");

const storage = multer.memoryStorage({

 destination:(req,file,cb)=>{
   cb(null,"/");
 },

 filename:(req,file,cb)=>{
   cb(null,Date.now()+"_"+file.originalname);
 }

});

const upload = multer({
  storage: storage,
  limits: {fieldSize: 1024 * 1024 * 20},
}).array("file", 5);

module.exports = upload;