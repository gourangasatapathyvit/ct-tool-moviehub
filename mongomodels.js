// https://www.freecodecamp.org/news/introduction-to-mongoose-for-mongodb-d2a7aa593c57/

// https://dev.to/dalalrohit/how-to-connect-to-mongodb-atlas-using-node-js-k9i

// https://stackblitz.com/


const mongoose = require('mongoose')

const movieMainPageSchema = mongoose.Schema({
    results: [
        {
            yearOfRelease: String,
            imagePath: String,
            title: String,
            overview: String,
            originalLanguage: String,
            imdbRating: String,
            bookMarkStatus: {
                type: String,
                default: "fa-regular"
            },
            originCountry: String,
            productionHouse: [String],

            itemsInformation: {
                itemType: {
                    type: String,
                    default: "not-defined"
                },
                NumberOfSeasons: {
                    type: Number,
                    default: 0
                },
                NumberOfEpisods: {
                    type: Number,
                    default: 0
                }
            }
        }
    ]
})


module.exports = {
    movieMainPageSchema: mongoose.model('movieMainPage', movieMainPageSchema),
}