
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
var phone_registry = {
    'Grand X Max 2': 'ZTE Grand X Max 2',
    'Xperia X Compact': 'Sony Xperia X Compact',
    'Moto X Play': 'Motorola Moto X Play',
    'Moto X Style': 'Motorola Moto X Style',
    'Galaxy J7 Prime': 'Samsung Galaxy J7 Prime',
    'Galaxy S II X': 'Samsung Galaxy S II X T989D',
    'X Power': 'LG X power',
    'HTC One (M8)': 'HTC One (M8)',
    'Samsung Galaxy S II X T989D': 'Samsung Galaxy S II X T989D',
    'Apple iPhone X': 'Apple iPhone X',
    '8 Lite': 'Huawei P8 Lite (2017)',
    'Apple iPhone 8': 'Apple iPhone 8',
    'Galaxy S7 edge': 'Samsung Galaxy S7 edge',
    'Galaxy A7 (2017)': 'Samsung Galaxy A7 (2017)',
    'Galaxy S8+': 'Samsung Galaxy S8+',
    'DROID Turbo 2': 'Motorola Droid Turbo 2',
    'Galaxy S7': 'Samsung Galaxy S7',
    'Stylo 2 V': 'LG Stylo 2',
    'Redmi Note 4': 'Xiaomi Redmi Note 4',
    'Xperia XZ': 'Sony Xperia XZ',
    'F3 Plus': 'Oppo F3 Plus',
    'Xperia XZ Premium': 'Sony Xperia XZ Premium',
    'BlackBerry Keyone': 'BlackBerry Keyone',
    'Samsung I9300 Galaxy S III': 'Samsung I9300 Galaxy S III',
    'Samsung Galaxy S7': 'Samsung Galaxy S7',
    'Sony Xperia T3': 'Sony Xperia T3',
    'Sony Xperia L1': 'Sony Xperia L1',
    'Sony Xperia XZs': 'Sony Xperia XZs',
    'Nokia Lumia 930': 'Nokia Lumia 930',
    'Motorola Moto Z Force': 'Motorola Moto Z Force',
    'Sony Xperia Z1 Compact': 'Sony Xperia Z1 Compact',
    'HTC Desire Eye': 'HTC Desire Eye',
    'LG Stylo 2': 'LG Stylo 2',
    'Apple iPhone 7': 'Apple iPhone 7'
};
var pending_phones = [];
var feature_registry = {};
var rejected_features = [];
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


mongoose.connect('mongodb://nilesh:akura@ds147544.mlab.com:47544/akura');


function getPhoneDetails(model, res) {
    console.log("came to  getPhoneDetails");
    var nameResolverPromises = [];
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

                        let promiseParents = [];
                        let promises = [];
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

                            if (pending_phones.indexOf(model) === -1) {
                                nameResolverPromises.push(resolvePhoneName(data.compareModel).then(() => { }, () => { }));
                            }

                            var secondary = {
                                "id": Date.now() + chance.fbid() + "SECONDARY-COMP",
                                "name": secondaryName,
                                "base_score": chance.floating({ min: 0, max: 1 }),
                                "property": []
                            };

                            json.entities.push(secondary);

                            data.betterThanFeatures.map((better) => {
                                let pr = new Promise((resolve, reject) => {
                                    extractEntity(better)
                                        .then((betterEntity) => {
                                            var primaryFeatureId = Date.now() + chance.fbid() + "-PRIMARY-F-B";
                                            var feature = {
                                                "id": primaryFeatureId,
                                                "name": betterEntity,
                                                "base_score": chance.floating({ min: 0.5, max: 1 }),
                                                "property": []
                                            };

                                            var feature2 = {
                                                "id": Date.now() + chance.fbid() + "-SECONDARY-F-B",
                                                "name": betterEntity,
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
                                            resolve({});
                                        }, (err) => {
                                            console.log("Entity Not extracted for " + better);
                                            resolve({});
                                        });
                                });
                                promises.push(pr);
                            });


                            data.worseThanFeatures.map((worse) => {
                                let pr = new Promise((resolve, reject) => {
                                    extractEntity(worse)
                                        .then((worseEntity) => {

                                            var primaryFeatureId = Date.now() + chance.fbid() + "-PRIMARY-F-W";
                                            var feature = {
                                                "id": primaryFeatureId,
                                                "name": worseEntity,
                                                "base_score": chance.floating({ min: 0.5, max: 1 }),
                                                "property": []
                                            };

                                            var feature2 = {
                                                "id": Date.now() + chance.fbid() + "-SECONDARY-F-W",
                                                "name": worseEntity,
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
                                            resolve({});
                                        }, (err) => {
                                            console.log("Entity Not extracted for " + worse);
                                            resolve({});
                                        });

                                });
                                promises.push(pr);
                            });
                            // promises.push(mainPromise);
                        });
                        console.log(promises.length);
                        Promise.all(promises).then(() => {
                            console.log("all promises resolved");
                            // FINAL OUTPUT
                            if (end) {
                                resolveJSONEntities(res, json, nameResolverPromises);
                                // res.json(json);
                            } else {
                                comparisonFunc(true, "compareModel");
                            }
                        });
                    }
                });
            }
        }
    });
}


function resolveJSONEntities(res, json, nameResolverPromises) {
    console.log("resolve entitiy called");
    Promise.all(nameResolverPromises).then(() => {
        console.log("all entities resovled");
        json.entities = json.entities.map((entity) => {
            if (phone_registry[entity.name]) {
                entity.name = phone_registry[entity.name];
            } else {
                console.log("Entity resolver not found for " + entity.name);
            }
            return entity;
        });
        console.log("resolve entities all promises done");
        res.json(json);
    });

}

function getPhoneName(model, res) {
    request.get('http://35.202.18.187:5000/phone/' + model, function (error, response, body) {
        if (!error) {
            try {
                var ph = JSON.parse(JSON.parse(body).data);
                res.send(ph.Model);
            } catch (e) {
                res.status(404).json({ message: "Not found" });
            }
        }
    });
}

function resolvePhoneName(model) {

    return new Promise((resolve, reject) => {
        console.log(phone_registry);
        if (phone_registry[model]) {
            console.log("resolving " + model + " to " + phone_registry[model] + " from cache");
            resolve(phone_registry[model]);
        } else {
            pending_phones.push(model);
            request.get('http://35.202.18.187:5000/phone/' + model, function (error, response, body) {
                if (!error) {
                    try {
                        var ph = JSON.parse(JSON.parse(body).data);
                        console.log("resolving " + model + " to " + ph.Model + " from HTTP");
                        phone_registry[model] = ph.Model;
                        pending_phones.splice(pending_phones.indexOf(model), 1);
                        console.log(phone_registry)
                        resolve(ph.Model);
                    } catch (e) {
                        console.log("Name not found for: " + model);
                        reject({});
                    }
                }
            });
        }
    });

}

function extractEntity(name) {

    return new Promise((resolve, reject) => {
        if (feature_registry[name]) {
            console.log("Feature resolved by cache: " + name);
            resolve(feature_registry[name]);
        } else if (rejected_features.indexOf(name) > -1) {
            console.log("Feature rejected by cache: " + name);
            reject(404);
        } else {
            console.log("Feature resolved by HTTP: " + name);
            request.get('http://35.198.251.53:4568/get-entity?entity=' + name, function (error, response, body) {
                if (!error) {
                    try {
                        var data = JSON.parse(body).data;
                        if (data) {
                            feature_registry[name] = data;
                            resolve(data);
                        } else {
                            rejected_features.push(name);
                            reject(404);
                        }
                    } catch (e) {
                        rejected_features.push(name);
                        reject("Exception for " + name);
                    }

                } else {
                    rejected_features.push(name);
                    reject(500);
                }

            });
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





// start the server
const server = app.listen(3002, function () {
    console.log('Data Feeder listening on port 3002!');
});

// increase the timeout to 4 minutes
server.timeout = 1000000; 