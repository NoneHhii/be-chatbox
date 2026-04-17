require('dotenv').config();
const s3 = require('../config/aws-config');

const randomString = numberCharacter => {
    return `${Math.random().toString(36).substring(2, numberCharacter + 2)}`;
}
const FILE_TYPE_MATCH = [
    // Images
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",

    // Audio & Video
    "audio/mpeg",
    "video/mp4",
    "video/quicktime",  //Định dạng .mov của iPhone hay dùng

    // Documents
    "application/pdf",
    "text/plain",
    "audio/m4a",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-powerpoint", // .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx

    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-zip-compressed",
];

const uploadFile = async file => {
    const filePath = `${randomString(4)}-${new Date().getTime()}-${file?.originalname}`;

    if(FILE_TYPE_MATCH.indexOf(file.mimetype) === -1) throw new Error(`${file?.originalname} is valid`);

    const uploadParams = {
        Bucket: process.env.BUCKET_NAME,
        Body: file.buffer,
        Key: filePath,
        ContentType: file?.mimetype,
    };

    try {
        const data = await s3.upload(uploadParams).promise();
        console.log(`File uploaded successfully. ${data.Location}`);
        const filename = `${process.env.CLOUDFRONT_NAME}${data.Key}`;
        return filename;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

module.exports = {
    uploadFile
}