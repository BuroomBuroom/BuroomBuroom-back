const express = require('express');
const app = express();
const { conn } = require("./config/config");
require("dotenv").config();
const axios = require('axios');

let day = new Date();
let toDate = day.getDate()
let today = day.getDay()
let toMonth = day.getMonth() + 1;
let toYear = day.getFullYear();

function getFirday(day) {
    switch (today) {
        case 1:
            toDate += 5
            break;
        case 2:
            toDate += 4
            break;
        case 3:
            toDate += 3
            break;
        case 4:
            toDate += 2
            break;
        case 5:
            toDate += 1
            break;
        case 6:
            toDate;
            break;
    }
    return toDate
}


conn.connect((err) => {
    if (err) {
        console.log(err)
    }
    else {
        console.log('mysql connecting...')
    }
})

app.get('/oauth', async(req, res) => {
    const authcode = req.query.code;
    if (authcode === undefined) {
        res.status(400).send('Authcode is required');
    }

    let TokenRequest;
    try {
        TokenRequest = await axios.post(process.env.GET_TOKEN_URL, {
            clientId: process.env.BSM_OAUTH_CLIENT_ID,
            clientSecret: process.env.BSM_OAUTH_CLIENT_SECRET,
            authCode: authcode
        });
    } catch (error) {
        res.status(400).send('Authcode is invaild');
    }
    const token = TokenRequest.data.token;
    if (token === undefined) {
        res.status(400).send('Authcode is invaild');
    }

    let ResourceRequest;
    try {
        ResourceRequest = await axios.post(process.env.GET_RESOURCE_URL, {
            clientId: process.env.BSM_OAUTH_CLIENT_ID,
            clientSecret: process.env.BSM_OAUTH_CLIENT_SECRET,
            token
        });
    } catch (error) {
        res.status(404).send('User not found');
    }
    const userInfo = ResourceRequest.data.user;
    if (userInfo === undefined) {
        res.status(404).send('User not found');
    }
    console.log(userInfo);
    conn.query(`insert into users(grade, classNo, studentNo, name) values(
        '${userInfo.grade}',
        '${userInfo.classNo}',
        '${userInfo.studentNo}',
        '${userInfo.name}')`, (err, result) => {
        if(err) {
            console.log(err)
            res.json({message: err, success: false})
        } 
        else if(result) {
            console.log(result)
            res.json({
                grade: userInfo.grade,
                classNo: userInfo.classNo,
                studentNo: userInfo.sutdentNo,
                studentName: userInfo.name
            })
        }
    })
});

app.get('/reservation', (req, res) => {
    // 사용자 이름, 좌석 정보, 예약 날짜, 시간, 만료 날짜(금주 토요일 고정)
    let friday = getFirday(day);
    console.log(`${toYear}-${toMonth}-${friday}`)
    const classNo = req.query.classNo;
    const studentNo = req.query.studentNo;
    const seatNo = req.query.seatNo;
    const reservationTime = req.query.reservationTime
    const reservationDay = req.query.reservationDay
    const expirationDay = req.query.expirationDay

    
})

app.listen(80);