const dotenv = require('dotenv');
const mysql = require('mysql');
dotenv.config();
const config = {
    host: process.env.MYSQL_HOST,
    port: '3306',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWARD,
    database: 'BuroomDB'
}

const conn = mysql.createConnection(config);


module.exports = { conn }