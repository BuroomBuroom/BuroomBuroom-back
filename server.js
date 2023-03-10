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
        else if (result.length === 0) { // DB??? ????????? ?????? ????????? => DB??? ??? ?????? ?????? ??????
            const token = jwt.sign({ // ?????? ??????
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
        else { // ?????? DB??? ????????? ?????? => DB?????? ????????? ??????
            conn.query(`select * from users 
            where classNo = ? and studentNo = ?`, [userInfo.classNo, userInfo.studentNo], 
            (err, result) => {
                if (err) {
                    res.json({ 'massage': err, success: false });
                } else {
                    console.log('?????? DB??? ????????? ?????????.')
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

app.get('/login_check', (req, res) => { // ????????? ????????? ?????? API
    const token = req.query.token
    conn.query(`select * from users where token = ?`, [token], // ??? ???????????? ???????????? ?????? ???????????? ????????????????
        (err, result) => {
            if (err) { // ?????? error ?????????
                console.log(err)
                res.json({ message: err, success: false })
            }
            if (result.length === 0) { // ???? ????????? ?????? => ??????????????? ????????????.
                res.json({ message: '????????? ???????????? ???????????? ???????????? ????????? ??????.', success: false })
            }
            else { // ??? ??? ????????? ?????????!?
                res.json({message: '????????? ?????????. ???????????? ?????????.', success: true})
            }
        })
})

app.get('/user_check', (req, res) => { // ?????? ????????? ?????? API
    const token = req.query.token
    const classNo = req.query.classNo;
    const studentNo = req.query.studentNo;
    conn.query(`select * from users where token = ?`, [token], // ??? ???????????? ???????????? ?????? ???????????? ????????????????
        (err, result) => {
            if (err) { // ?????? error ?????????
                console.log(err)
                res.json({ message: err, success: false })
            }
            if (result.length === 0) { // ???? ????????? ?????? => ??????????????? ????????????.
                res.json({ message: '????????? ???????????? ???????????? ???????????? ????????? ??????.', success: false })
            }
            else { // ??? ??? ????????? ?????????!?
                console.log(result[0].studentNo)
                if (result[0].studentNo == studentNo && result[0].classNo == classNo) { // ??? ???????????? ??????????????? ?????? ????????? ??????????
                    res.json({ message: '????????? ?????????', name: result[0].name, success: true })
                } else {
                    res.json({ message: '???????????? ?????? ?????????', success: false })
                }
            }
        })
})

app.get('/reservation', (req, res) => { // ?????? ?????? API(C)
    // ????????? ??????, ?????? ??????, ?????? ??????, ??????, ?????? ??????(?????? ????????? ??????)
    let friday = getFirday();
    const seatNo = req.query.seatNo;
    const reservationDay = req.query.reservationDay // ???.???.???.???.???.???
    const expirationDay = `${toYear}-${toMonth}-${friday}`
    const token = req.query.token

    conn.query(`select id from users where token = ?`, [token],
    (err, result) => {
        const userId = result[0].id
        if (err) { // ?????? error ?????????
            console.log(err)
            res.json({ message: err, success: false })
        }
        else {
            conn.query(`insert into reservation(userId, seatNo, reservationDay, expirationDay) values(?,?,?,?)`,
            [userId, seatNo, reservationDay, expirationDay],
            (err, result) => {
                if (err) { // ?????? error ?????????
                    console.log(err)
                    res.json({ message: err, success: false })
                } else {
                    console.log(result)
                    res.json({ message: '?????? ?????? ??????', success: true })
                }
            })
        }
    })
})

app.get('/ticket', (rep, res) => { // ?????? ?????? API(R)
    const token = req.query.token
    
    conn.query(`select id from users where token = ?`, [token], // ???????????? ?????? ????????? ????????????
    (err, result) => {
        const grade = result[0].grade;
        const classNo = result[0].classNo;
        const studentNo = result[0].studentNo;
        const name = result[0].name;
        if (err) { // ?????? error ?????????
            console.log(err)
            res.json({ message: err, success: false })
        } else {
            conn.query(`select * from reservation where userId = ?`, [result[0].id], // ????????? ?????? ????????? ????????? ?????? ????????????
            (err, result) => {
                if (err) { // ?????? error ?????????
                    console.log(err)
                    res.json({ message: err, success: false })
                } else {
                    return res.json({ // ?????? ????????? ????????? ????????? ??????
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

app.get('/reservation_update', (req, res) => { // ?????? ????????????(U)
    const updateSeatNo = req.query.seatNo;
    const updateDay = req.query.reservationDay;
    const userId = req.query.id;

    conn.query(`UPDATE reservation
                SET seat = ?, reservationDay = ?
                WHERE userId = ?`,
                [updateSeatNo, updateDay, userId],
                (err, result) => {
                    if (err) { // ?????? error ?????????
                        console.log(err)
                        res.json({ message: err, success: false })
                    } else {
                        res.json({message: `${updateSeatNo}??? ????????? ???????????? ?????????.`, success: true})
                    }
            })
})

app.get('/reservation_cancel', (req, res) => { // ?????? ??????(D)
    const seatNo = req.query.seatNo;
    conn.query(`DELETE FROM reservation where seat = ?`, [seatNo], 
    (err, result) => {
        if (err) { // ?????? error ?????????
            console.log(err)
            res.json({ message: err, success: false })
        } else {
            res.json({ message: `????????? ?????? ?????? ?????????.`, success: true })
        }
    })
})

app.listen(80);