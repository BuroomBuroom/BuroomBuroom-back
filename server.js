const axios = require("axios");
const cheerio = require("cheerio");
const iconv = require("iconv-lite");
const fs = require('fs');

var lastPage = 0
var cnt = 1
let courses = []

const getHTML = async(keyword, page) => {
  try {
    return await axios.get(`https://www.inflearn.com/courses?s=${encodeURI(keyword)}&page=${page}`)
  } catch (e) {
    console.log(e)
  }
}

const parsing = async(keyword, page) => {
  const html = await getHTML(keyword, cnt)
  const $ = cheerio.load(html.data)
  const $courseList = $(".course_card_item")
  const $paginationList = $(".pagination_container")
  const pageList = []

  $paginationList.each((i, node) => {
    pageList.push({
      page: $(node).find(".pagination-list > li > a.pagination-link ").text()
    })
  })
  page = pageList[0].page
  lastPage = page[page.length - 2] + page[page.length - 1]
  if(Number(lastPage) + 1 == cnt) {
    fs.writeFile(`inflearn-${keyword}.json`, JSON.stringify(courses), 'utf8', function (err) {
      if (err) console.log(err.message)
    });
    return console.log('모든 강의 자료를 들고 왔습니다!');
  }
  else {
    $courseList.each((i, elem) => {
      const title = $(elem).find(".course_title:eq(0)").text()
      const instructor = $(elem).find(".instructor").text()
      const rating = $(elem).find(".star_solid").css("width")
      const price = $(elem).find(".price").text()
      const img = $(elem).find(".card-image > figure > img").attr("src")
      courses.push({
        title: title,
        instructor: instructor,
        rating: rating,
        price: price,
        img: img
      })
    })
    cnt++
    console.log(courses)
    console.log(Number(lastPage) + 1, cnt)
    return parsing(keyword, cnt)
  }
}

parsing("자바스크립트", 1)