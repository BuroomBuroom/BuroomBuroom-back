const express = require('express');
const app = express();
const { conn } = require("./config/config");
require("dotenv").config();
const axios = require('axios');
const jwt = require('jsonwebtoken');


let day = new Date();
let toDate = day.getDate()
let today = day.getDay()
let toMonth = day.getMonth() + 1;
let toYear = day.getFullYear();

function getFirday() {
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
    conn.query(`select * from users where classNo = ? and studentNo = ?`, [userInfo.classNo, userInfo.studentNo],
    (err, result) => {
        if (err) {
            console.log(err)
            res.json({ message: err, success: false })
        }
        else if (result.length === 0) { // DB에 저장된 값이 없으면 => DB에 값 넣고 토큰 발급
            const token = jwt.sign({ // 토큰 발급
                type: 'JWT',
                name: userInfo.name,
                grade: userInfo.grade,
            }, process.env.JWT_SECRET);
            conn.query(`insert into users(token, grade, classNo, studentNo, name) values(?,?,?,?,?)`, 
            [token, userInfo.grade, userInfo.classNo, userInfo.studentNo, userInfo.name], 
            (err, result) => { // insert
                if (err) {
                    console.log(err)
                    res.json({ message: err, success: false })
                }
                else if (result) {
                    return res.json({
                        token: token,
                        grade: userInfo.grade,
                        classNo: userInfo.classNo,
                        studentNo: userInfo.sutdentNo,
                        studentName: userInfo.name,
                        success: true
                    })
                }
            })
        }
        else { // 이미 DB에 저장된 유저 => DB에서 찾아서 리턴
            conn.query(`select * from users 
            where classNo = ? and studentNo = ?`, [userInfo.classNo, userInfo.studentNo], 
            (err, result) => {
                if (err) {
                    res.json({ 'massage': err, success: false });
                } else {
                    console.log('이미 DB에 저장된 유저임.')
                    return res.json({
                        token : token,
                        grade: result[0].grade,
                        classNo: result[0].classNo,
                        studentNo: result[0].sutdentNo,
                        studentName: result[0].name,
                        success: true
                    })
                }
            });
        }
    })
});

app.get('/login_check', (req, res) => { // 로그인 무결성 검사 API
    const token = req.query.token
    conn.query(`select * from users where token = ?`, [token], // 본 사용자가 로그인을 하고 서비스를 이용하는가?
        (err, result) => {
            if (err) { // 단순 error 처리문
                console.log(err)
                res.json({ message: err, success: false })
            }
            if (result.length === 0) { // 어? 토큰이 없네 => 로그인하고 이용해라.
                res.json({ message: '토큰이 유호하지 못하거나 사용자의 토큰이 아님.', success: false })
            }
            else { // 오 너 로그인 했구나!?
                res.json({message: '토큰이 유호함. 로그인한 유저임.', success: true})
            }
        })
})

app.get('/user_check', (req, res) => { // 유저 무결성 검사 API
    const token = req.query.token
    const classNo = req.query.classNo;
    const studentNo = req.query.studentNo;
    conn.query(`select * from users where token = ?`, [token], // 본 사용자가 로그인을 하고 서비스를 이용하는가?
        (err, result) => {
            if (err) { // 단순 error 처리문
                console.log(err)
                res.json({ message: err, success: false })
            }
            if (result.length === 0) { // 어? 토큰이 없네 => 로그인하고 이용해라.
                res.json({ message: '토큰이 유호하지 못하거나 사용자의 토큰이 아님.', success: false })
            }
            else { // 오 너 로그인 했구나!?
                console.log(result[0].studentNo)
                if (result[0].studentNo == studentNo && result[0].classNo == classNo) { // 본 사용자가 예약하고자 하는 고객이 맞는가?
                    res.json({ message: '올바른 사용자', name: result[0].name, success: true })
                } else {
                    res.json({ message: '올바르지 않은 사용자', success: false })
                }
            }
        })
})

app.get('/reservation', (req, res) => { // 예약 처리 API(C)
    // 사용자 이름, 좌석 정보, 예약 날짜, 시간, 만료 날짜(금주 토요일 고정)
    let friday = getFirday();
    const seatNo = req.query.seatNo;
    const reservationDay = req.query.reservationDay // 년.월.일.시.분.초
    const expirationDay = `${toYear}-${toMonth}-${friday}`
    const token = req.query.token

    conn.query(`select id from users where token = ?`, [token],
    (err, result) => {
        const userId = result[0].id
        if (err) { // 단순 error 처리문
            console.log(err)
            res.json({ message: err, success: false })
        }
        else {
            conn.query(`insert into reservation(userId, seatNo, reservationDay, expirationDay) values(?,?,?,?)`,
            [userId, seatNo, reservationDay, expirationDay],
            (err, result) => {
                if (err) { // 단순 error 처리문
                    console.log(err)
                    res.json({ message: err, success: false })
                } else {
                    console.log(result)
                    res.json({ message: '좌석 예약 완료', success: true })
                }
            })
        }
    })
})

app.get('/ticket', (rep, res) => { // 티켓 발급 API(R)
    const token = req.query.token
    
    conn.query(`select id from users where token = ?`, [token], // 토큰으로 유저 데이터 들고오기
    (err, result) => {
        const grade = result[0].grade;
        const classNo = result[0].classNo;
        const studentNo = result[0].studentNo;
        const name = result[0].name;
        if (err) { // 단순 error 처리문
            console.log(err)
            res.json({ message: err, success: false })
        } else {
            conn.query(`select * from reservation where userId = ?`, [result[0].id], // 외래키 이용 유저가 예약한 정보 들고오기
            (err, result) => {
                if (err) { // 단순 error 처리문
                    console.log(err)
                    res.json({ message: err, success: false })
                } else {
                    return res.json({ // 티켓 발급에 필요한 데이터 리턴
                        grade: grade,
                        classNo: classNo,
                        studentNo: studentNo,
                        name: name,
                        userId: result[0].userId,
                        seatNo: result[0].seat,
                        reservationDay: result[0].reservationDay,
                        expirationDay: result[0].expirationDay,
                        success: true
                    })
                }
            })
        }
    })
})

app.get('/reservation_update', (req, res) => { // 예약 업데이트(U)
    const updateSeatNo = req.query.seatNo;
    const updateDay = req.query.reservationDay;
    const userId = req.query.id;

    conn.query(`UPDATE reservation
                SET seat = ?, reservationDay = ?
                WHERE userId = ?`,
                [updateSeatNo, updateDay, userId],
                (err, result) => {
                    if (err) { // 단순 error 처리문
                        console.log(err)
                        res.json({ message: err, success: false })
                    } else {
                        res.json({message: `${updateSeatNo}로 좌석이 업데이트 되었음.`, success: true})
                    }
            })
})

app.get('/reservation_cancel', (req, res) => { // 예약 취소(D)
    const seatNo = req.query.seatNo;
    conn.query(`DELETE FROM reservation where seat = ?`, [seatNo], 
    (err, result) => {
        if (err) { // 단순 error 처리문
            console.log(err)
            res.json({ message: err, success: false })
        } else {
            res.json({ message: `좌석이 예약 취소 되었음.`, success: true })
        }
    })
})

app.listen(80);