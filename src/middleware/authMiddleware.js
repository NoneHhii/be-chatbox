const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.headers.authorization;

    if(!token) return res.status(401).json("Unauthorized");

    try {
        const decoded = jwt.verify(token, "SECRET");

        req.user = decoded;

        next();
    } catch (error) {
        console.log(error);
        res.status(401).json("Invalid token");
    }
}