require("dotenv").config();
const sharp = require("sharp");
const axios = require("axios");
const FormData = require("form-data");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const mongoose = require("mongoose");
const mongomodels = require("./mongomodels");
mongoose.set("strictQuery", true);
const url = process.env.mongourl;

const bot = new TelegramBot(process.env.token, { polling: true });

const doc = new GoogleSpreadsheet(process.env.googleSpreadsheetApi);

async function resizeImage(
  url,
  accessToken,
  size = { width: 256, height: 256 }
) {
  return await axios
    .get(url, { responseType: "arraybuffer" })
    .then(async (response) => {
      return await sharp(response.data)
        .resize(size.width, size.height)
        .toBuffer()
        .then(async (resizedImageBuffer) => {
          const formData = new FormData();
          formData.append("image", resizedImageBuffer);
          return await axios
            .post("https://api.imgur.com/3/image", formData, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                ...formData.getHeaders(),
              },
            })
            .then((response) => {
              return response.data.data.link;
            })
            .catch((error) => {
              console.error("Error uploading to Imgur:", error.response.data);
            });
        })
        .catch((error) => {
          console.error("Error resizing image:", error);
        });
    })
    .catch((error) => {
      console.error("Error fetching image:", error);
    });
}

function imageUpload(url, accessToken, size) {
  return resizeImage(url, accessToken, size);
}

async function lora(msgChatId) {
  let xx = await mongomodels.movieMainPageSchema.find({}, "_id");

  await doc.useServiceAccountAuth({
    client_email: process.env.clientEmail,
    private_key: process.env.privateKey.replace(/\\n/g, "\n"),
  });

  await doc.loadInfo();

  // read
  const infoSheet = doc.sheetsByIndex[1];
  const sheet = doc.sheetsByIndex[0];
  const infoRows = await infoSheet.getRows({ limit: undefined, offset: 0 });

  let tempCounter = parseInt(infoRows[0].counter);
  const rows = await sheet.getRows({ limit: undefined, offset: tempCounter });

  for (let data in rows) {
    let titleimageLink = await imageUpload(
      rows[data].imagePath,
      process.env.accessToken,
      { width: 712, height: 400 }
    );
    rows[data].titleimage = titleimageLink;
    await rows[data].save();

    // console.log(
    //   rows[data].yearOfRelease,
    //   rows[data].titleimage,
    //   rows[data].title,
    //   rows[data].overview,
    //   rows[data].originalLanguage,
    //   rows[data].imdbRating,
    //   rows[data].originCountry,
    //   rows[data].productionHouse.split(","),
    //   rows[data].productionHouse.split(",")[0],
    //   rows[data].productionHouse.split(",")[1],
    //   rows[data].productionHouse.split(",")[2]
    // );

    await mongomodels.movieMainPageSchema.updateOne(
      {
        _id: xx[0]._id,
      },
      {
        $push: {
          results: {
            yearOfRelease: rows[data].yearOfRelease,
            imagePath: rows[data].titleimage,
            title: rows[data].title,
            overview: rows[data].overview,
            originalLanguage: rows[data].originalLanguage,
            imdbRating: rows[data].imdbRating,
            originCountry: rows[data].originCountry,
            productionHouse: rows[data].productionHouse.split(","),
            itemsInformation: {
              itemType: rows[data].itemsInformation.split(",")[0],
              NumberOfSeasons: rows[data].itemsInformation.split(",")[1],
              NumberOfEpisods: rows[data].itemsInformation.split(",")[2],
            },
          },
        },
      }
    );

    console.log("res", titleimageLink);
    bot.sendMessage(msgChatId, `uploaded - ${titleimageLink}`);
    tempCounter++;
  }

  infoRows[0].counter = tempCounter;
  await infoRows[0].save();

  console.log("all task executed", tempCounter);
  return tempCounter;

  // await sheet.loadCells('A1')
  // console.log('==');
  // let a1 = sheet.getCell(0, 1);
  // const c6 = sheet.getCellByA1('C1')
}

async function tbot() {
  bot.on("message", async (msg) => {
    // console.log('triggered');
    if (msg.text === "1") {
      let totalCounter = await lora(msg.chat.id);
      bot.sendMessage(msg.chat.id, `total record available - ${totalCounter}`);
      bot.deleteMessage(msg.chat.id, msg.message_id);
    } else {
      bot.sendMessage(
        msg.chat.id,
        `you need to enter the right key to update your spreadsheet`
      );
      bot.deleteMessage(msg.chat.id, msg.message_id);
    }
  });
}

mongoose.connect(url, async () => {
  console.log("mongo connected");
});

tbot();