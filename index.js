var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var Phone = require('./models/phone');
var PhoneComparison = require('./models/phone_comparisons');
var request = require('request');
var Chance = require('chance');

// Instantiate Chance so it can be used
var chance = new Chance();

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


mongoose.connect('mongodb://nilesh:akura@ds147544.mlab.com:47544/akura');

function getPhoneDetails(model, res) {

    request.get('http://35.202.18.187:5000/phone/' + model, function (error, response, body) {
        if (!error) {
            var ph = JSON.parse(JSON.parse(body).data);

            var json = {
                "review_info": {
                    "id": Date.now() + "-REVIEW",
                    "user_name": "",
                    "email": chance.email({ domain: 'gmail.com' }),
                    "comment": chance.paragraph({ sentences: 1 }),
                    "rating": chance.floating({ min: -1.0, max: 1 }),
                    "property": []
                },
                "entities": [],
                "relationships": []
            }


            // setting main entity

            json.entities.push({
                id: Date.now() + "-MAIN",
                "base_score": chance.floating({ min: 0, max: 1 }),
                "property": []
            });

            json.relationships.push({
                type: "MainEntity",
                domain: json.review_info.id,
                range: json.entities[0].id
            });


            for (var key in ph) {
                if (ph.hasOwnProperty(key)) {
                    if (key != "Model") {
                        if (ph[key] != "\n") {
                            json.entities[0].property.push({
                                key: key,
                                value: ph[key]
                            })
                        }
                    } else {
                        json.entities[0].name = ph[key];
                    }
                }
            }

            console.log(json.entities[0].name);
            // add features  and better than for main entity

            comparisonFunc(false, "name");

            function comparisonFunc(end, searchKey) {
                var search = {};
                search[searchKey] = json.entities[0].name;
                PhoneComparison.find(search, function (err, comparisons) {
                    if (err) {
                        console.log("err", err);
                    } else {

                        // get an array of comparisons between 2 phones
                        comparisons.map((data) => {
                            // create secondary phone
                            var secondaryName;
                            if (Array.isArray(data.compareModel)) {
                                secondaryName = data.compareModel[0];
                            } else {
                                secondaryName = data.compareModel;
                            }
                            // TODO compare model name get the correct name
                            console.log(data.compareModel);
                            if (!data.compareModel) {
                                return;
                            }
                            var secondary = {
                                "id": Date.now() + chance.fbid() + "SECONDARY-COMP",
                                "name": secondaryName,
                                "base_score": chance.floating({ min: 0, max: 1 }),
                                "property": []
                            }

                            json.entities.push(secondary);
                            data.betterThanFeatures.map((better) => {

                                var primaryFeatureId = Date.now() + chance.fbid() + "-PRIMARY-F-B";
                                var feature = {
                                    "id": primaryFeatureId,
                                    "name": better,
                                    "base_score": chance.floating({ min: 0.5, max: 1 }),
                                    "property": []
                                };

                                var feature2 = {
                                    "id": Date.now() + chance.fbid() + "-SECONDARY-F-B",
                                    "name": better,
                                    "base_score": chance.floating({ min: 0.5, max: 1 }),
                                    "property": []
                                };


                                // setting for primary
                                json.entities.push(feature);
                                json.relationships.push({
                                    type: "Feature",
                                    domain: json.entities[0].id,
                                    range: feature.id
                                });

                                // setting for secondary

                                json.entities.push(feature2);
                                json.relationships.push({
                                    type: "Feature",
                                    domain: secondary.id,
                                    range: feature2.id
                                });


                                // add better than
                                json.relationships.push({
                                    type: "BetterThan",
                                    domain: feature.id,
                                    range: feature2.id
                                });
                            });

                            data.worseThanFeatures.map((worse) => {

                                var primaryFeatureId = Date.now() + chance.fbid() + "-PRIMARY-F-W";
                                var feature = {
                                    "id": primaryFeatureId,
                                    "name": worse,
                                    "base_score": chance.floating({ min: 0.5, max: 1 }),
                                    "property": []
                                };

                                var feature2 = {
                                    "id": Date.now() + chance.fbid() + "-SECONDARY-F-W",
                                    "name": worse,
                                    "base_score": chance.floating({ min: 0.5, max: 1 }),
                                    "property": []
                                };

                                // setting for primary
                                json.entities.push(feature);
                                json.relationships.push({
                                    type: "Feature",
                                    domain: json.entities[0].id,
                                    range: feature.id
                                });

                                // setting for secondary

                                json.entities.push(feature2);
                                json.relationships.push({
                                    type: "Feature",
                                    domain: secondary.id,
                                    range: feature2.id
                                });

                                // add worse than
                                json.relationships.push({
                                    type: "BetterThan",
                                    domain: feature2.id,
                                    range: feature.id
                                });
                            });
                        });
                        // FINAL OUTPUT
                        if (end) {
                            res.json(json);
                        } else {
                            comparisonFunc(true, "compareModel");
                        }
                    }
                });
            }
        }
    });
}


function getPhoneName(model, res) {
    request.get('http://35.202.18.187:5000/phone/' + model, function (error, response, body) {
        if (!error) {
            try{
            var ph = JSON.parse(JSON.parse(body).data);
            res.send(ph.Model);
            }catch(e){
              res.status(404).json({message:"Not found"});  
            }
        }
    });
}


app.get("/phone/:name", (req, res) => {
    var model = req.params.name;
    getPhoneDetails(model, res);
});

app.get("/phone_name/:name", (req, res) => {
    var model = req.params.name;
    getPhoneName(model, res);
});



app.listen(3002, function () {

    // PhoneComparison.find({ compareModel: "iPhone 5" }, function (err, result) {
    //     if (err) {
    //         console.log("err", err);
    //     } else {
    //         console.log(result);
    //     }
    // });

    console.log('Example app listening on port 3002!');
});