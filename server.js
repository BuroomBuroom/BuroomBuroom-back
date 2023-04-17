const express = require('express');
const cors = require('cors');
const app = express();
const { conn } = require("./config/config");
require("dotenv").config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const url = require('url');
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors({
    origin: '*', // 모든 출처 허용 옵션. true 를 써도 된다.
}));

function getSaturday() {
    var currentDay = new Date();
    var theYear = currentDay.getFullYear();
    var theMonth = currentDay.getMonth();
    var theDate = currentDay.getDate();
    var theDayOfWeek = currentDay.getDay();

    var thisWeek = [];

    for (var i = 0; i < 7; i++) {
        var resultDay = new Date(theYear, theMonth, theDate + (i - theDayOfWeek));
        var yyyy = resultDay.getFullYear();
        var mm = Number(resultDay.getMonth()) + 1;
        var dd = resultDay.getDate();

        mm = String(mm).length === 1 ? '0' + mm : mm;
        dd = String(dd).length === 1 ? '0' + dd : dd;

        thisWeek[i] = yyyy + '-' + mm + '-' + dd;
    }

    console.log(thisWeek[6]);
    return thisWeek[6];
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
                auth : true
            }, 
            "secretkey",
            {
                subject: 'certification',
                issuer: 'over'
            });
            conn.query(`insert into users(token, grade, classNo, studentNo, name) values(?,?,?,?,?)`, 
            [token, userInfo.grade, userInfo.classNo, userInfo.studentNo, userInfo.name], 
            (err, result) => { // insert
                if (err) {
                    console.log(err)
                    res.json({ message: err, success: false })
                }
                else if (result) {
                    const query = querystring.stringify({
                        "user_token": token,
                        "success": true
                    });
                    return res.redirect('/login_success?' + query)
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
                    const query = querystring.stringify({
                        "user_token": result[0].token,
                        "success": true
                    });
                    return res.redirect('/login_success?' + query)
                }
            });
        }
    })
});

app.get('/login_success', (req, res) => {
    res.json({
        message: 'login success!',
        user_token : req.query.token,
        success : req.query.success
    })
})

app.post('/user_info', (req, res) => { // 사용자 정보 리턴 해주는 API
    const token = req.body.token;
    try {
        var check = jwt.verify(token, "secretkey",);
        if (check) { // 토큰 값이 유효한지 체크
            console.log(check.auth); 
            if (check.auth) { // auth가 true인지 체크 -> 이상한 토큰 값을 거름
                conn.query(`select * from users where token = ?`, [token], (err, result) => { // 안전한 토큰 값을 확인한 후에 쿼리
                    if (err) { // 단순 error 처리문
                        console.log(err)
                        res.json({ message: err, success: false })
                    }
                    if (result.length === 0) { // 이 토큰으로 검색되는 유저 정보 값이 없을 시에
                        res.json({ message: '토큰 값이 잘못 되어 검색된 사용자 정보가 없음.', success: false })
                    }
                    else { // 토큰 값이 유효해서 사용자 정보가 DB에서 제대로 불러와짐
                        res.json({
                            message: '토큰 값이 유효하여 사용자 정보를 리턴함.',
                            grade: result[0].grade,
                            classNo: result[0].classNo,
                            studentNo: result[0].sutdentNo,
                            studentName: result[0].name,
                            success: true
                        })
                    }
                })
            }
        }
    } catch (err) {
        console.error(err);
        return res.json({ message: err.message, success: false });
    }
})

app.post('/login_check', (req, res) => { // 로그인 무결성 검사 API
    const token = req.body.token
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

app.post('/user_check', (req, res) => { // 유저 무결성 검사 API
    const token = req.body.token
    const classNo = req.body.classNo;
    const studentNo = req.body.studentNo;
    const grade = req.boody.grade
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
                if (result[0].studentNo == studentNo && result[0].classNo == classNo && result[0].grade == grade) { // 본 사용자가 예약하고자 하는 고객이 맞는가?
                    res.json({ message: '올바른 사용자', name: result[0].name, success: true })
                } else {
                    res.json({ message: '올바르지 않은 사용자', success: false })
                }
            }
        })
})

app.post('/reservation', (req, res) => { // 예약 처리 API(C)
    // 사용자 이름, 좌석 정보, 예약 날짜, 시간, 만료 날짜(금주 토요일 고정)
    const seatNo = req.body.seatNo;
    const reservationDay = req.body.reservationDay // 년.월.일.시.분.초
    const expirationDay = getSaturday()
    const token = req.body.token

    conn.query(`select id from users where token = ?`, [token],
    (err, result) => {
        const userId = result[0].id
        if (err) { // 단순 error 처리문
            console.log(err)
            res.json({ message: err, success: false })
        }
        else {
            conn.query(`insert into reservation(userId, seat, reservationDay, expirationDay) values(?,?,?,?)`,
            [userId, seatNo, reservationDay, expirationDay],
            (err, result) => {
                if (err) { // 단순 error 처리문
                    console.log(err)
                    res.json({ message: err, success: false })
                } else {
                    res.json({ message: '좌석 예약 완료', success: true })
                }
            })
        }
    })
})

app.post('/ticket', (req, res) => { // 티켓 발급 API(R)
    const token = req.body.token
    
    conn.query(`select * from users where token = ?`, [token], // 토큰으로 유저 데이터 들고오기
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

app.patch('/reservation_update', (req, res) => { // 예약 업데이트(U)
    const updateSeatNo = req.query.seatNo;
    const updateDay = req.query.reservationDay;
    const userId = req.query.userId;

    conn.query(`UPDATE reservation
                SET seat = ?, reservationDay = ?
                WHERE userId = ?`,
                [updateSeatNo, updateDay, userId],
                (err, result) => {
                    if (err) { // 단순 error 처리문
                        console.log(err)
                        res.json({ message: err, success: false })
                    } else {
                        console.log(result)
                        res.json({message: `${updateSeatNo}로 좌석이 업데이트 되었음.`, success: true})
                    }
            })
})

app.delete('/reservation_cancel', (req, res) => { // 예약 취소(D)
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