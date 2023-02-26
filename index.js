require("dotenv").config();
const sharp = require("sharp");
const axios = require("axios");
const FormData = require("form-data");
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const mongoose = require("mongoose");
const mongomodels = require("./mongomodels");

const app = express();
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
  let eachQualityLinkList = [];

  for (let data in rows) {
    let titleimageLink = await imageUpload(
      rows[data].imagePath,
      process.env.accessToken,
      { width: 712, height: 400 }
    );

    let moreInfoTitleImageLink = await imageUpload(
      rows[data].imagePath,
      process.env.accessToken,
      { width: 600, height: 300 }
    );

    let allImageQualityLinkList = rows[data].imageQuality.split(",");
    eachQualityLinkList = [];

    for (const item of allImageQualityLinkList) {
      let eachQualityLink = await imageUpload(item, process.env.accessToken, {
        width: 720,
        height: 400,
      });
      eachQualityLinkList.push(eachQualityLink);
    }

    rows[data].titleimage = titleimageLink;
    rows[data].moreInfoTitleImage = moreInfoTitleImageLink;
    rows[data].allImageQualityLink = String(eachQualityLinkList);
    await rows[data].save();

    await mongomodels.movieMainPageSchema.updateOne(
      {
        _id: xx[0]._id,
      },
      {
        $push: {
          results: {
            yearOfRelease: rows[data].yearOfRelease,
            imagePath: rows[data].titleimage,
            moreInfoTitleImage: moreInfoTitleImageLink,
            allImageQualityLink: rows[data].allImageQualityLink.split(","),
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

    bot.sendMessage(msgChatId, `uploaded - ${titleimageLink}`);
    tempCounter++;
  }

  infoRows[0].counter = tempCounter;
  await infoRows[0].save();

  console.log("all task executed", tempCounter);
  return tempCounter;

  // await sheet.loadCells('A1')
  // let a1 = sheet.getCell(0, 1);
  // const c6 = sheet.getCellByA1('C1')
}

async function tbot() {
  bot.on("message", async (msg) => {
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

tbot();

// mongomodels.movieMainPageSchema.create(
//   {
//     "results": [
//       {
//         "yearOfRelease": "2022",
//         "imagePath": "https://upload.wikimedia.org/wikipedia/en/d/d4/The_Kashmir_Files_poster.jpg",
//         "moreInfoTitleImage":"https://upload.wikimedia.org/wikipedia/en/d/d4/The_Kashmir_Files_poster.jpg",
//         "title": "The Kashmir Files",
//         "overview": "Krishna endeavours to uncover the reason behind his parents' brutal killings in Kashmir. He is shocked to uncover a web of lies and conspiracies in connection with the massive genocide.",
//         "originalLanguage": "hi",
//         "imdbRating": "8.3",
//         "originCountry": "india",
//         "productionHouse": ["Zee Studios"],
//         "itemsInformation": {
//           "itemType": "Movie"
//         }
//       },
//       {
//         "yearOfRelease": "2019",
//         "imagePath": "https://upload.wikimedia.org/wikipedia/en/d/dc/The_Family_Man.jpeg",
//         "moreInfoTitleImage":"https://upload.wikimedia.org/wikipedia/en/d/dc/The_Family_Man.jpeg",
//         "title": "The Family Man",
//         "overview": "Srikant Tiwari is a middle-class man who also serves as a world-class spy; he tries to balance his familial responsibilities with those at the highly secretive special cell of the National Intelligence Agency.",
//         "originalLanguage": "hi",
//         "imdbRating": "7.4",
//         "originCountry": "india",
//         "productionHouse": ["D2R Films"],
//         "itemsInformation": {
//           "itemType": "Series",
//           "NumberOfSeasons": 2,
//           "NumberOfEpisods": 19
//         }
//       }
//     ]
//   }

// )

app.get("/", (req, res) => {
  res.send({ status: "ok" });
});

mongoose.connect(url);
mongoose.connection.once("open", () => {
  app.emit("ready");
});

app.on("ready", function () {
  app.listen(process.env.PORT || 8092, () => {
    console.log("Server connected at:", process.env.PORT);
  });
});
