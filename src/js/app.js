/**
 * Created by user on 01.09.15.
 */
(function() {
    'use strict';

    var strundefined = typeof undefined;

    /**
     * console.warn
     */
    var warn = function(){
        console.warn.apply(console, arguments);
    };

    var app = {
        config: {
            f7_enable: true,
            f7_config: {
                template7Pages:true
            },
            dom7_enable: true,
            JSAPI_enable: true,
            debug: false
        },
        platform: 'iOS',
        free: true,
        /**
         * Framework7
         */
        f7: null,
        /**
         * Framework7 main view
         */
        view: null,
        /**
         * Framework7 DOM library
         */
        dom7: null,
        adTime: null,
        /**
         * iOS/Android native functions bridge library
         */
        JSAPI: null,
        loadingDisabled: true,
        loadingFakeTime: 2000,
        loadingAnimationTime: 700,
        maxSpeedKM: 68,
        maxSpeedM: 40,
        distance: 0,
        startAngleA: null,
        startAngleB: null,
        startAngleG: null,
        motionAccelerationOld: {x: 0, y: 0, z: 0},
        distanceAcc: 0,
        settings: {
            units: 'KM',//KM, M
            notFirstLaunch: false,
            distanceByGPS: false
        },
        settingsDefault: {
            units: 'KM',//KM, M
            notFirstLaunch: false,
            distanceByGPS: false
        },
        meta: {
            hashtag: "#app",
            language: ["en", "ru"],
            languageDefault: 0,
            languageCurrent: 1
        },

        startCoordinates: null,
        lastCoordinates: null,
        maxSpeed: 0,
        startDate: null,
        /**
         * Инициализация приложения
         */
        init: function () {

            window.app = app;


            /**
             * определяем язык
             * var lang = window.location.search.substr(1) || 'en';
             * app.meta.languageCurrent = app.indexOfVal(app.meta.language, lang);
             * app.dom7('body').addClass('lang-'+app.meta.language[app.meta.languageCurrent]);
             **/

            /**
             * определяем язык 2
             **/

            var lang = app.dom7('html').attr('lang') || app.meta.language[app.meta.languageDefault];
            app.meta.languageCurrent = app.indexOfVal(app.meta.language, lang);
            app.dom7('body').addClass('lang-' + app.meta.language[app.meta.languageCurrent]);

            String.prototype.translate = function(translateTo){
                var lang;
                if(typeof translateTo == strundefined){
                    lang = app.meta.language[app.meta.languageCurrent];
                } else {
                    lang = translateTo;
                }
                var translateStr = '', need_str = '';
                for(var translateObject in translate){
                    for(translateStr in translate[translateObject]){
                        if(translate[translateObject][translateStr] == this){
                            need_str = translate[translateObject][lang];

                            //если слова на этом языке нет - отдаем слово на дефолтном
                            if(need_str == '' || typeof need_str == strundefined){
                                warn("No translated string [<"+this+">, translate."+translateObject+"] for language "+lang+"!");
                                var lang_default = app.meta.language[app.meta.languageDefault];
                                var need_str_def = translate[translateObject][lang_default];
                                //если слова нет и на дефолтном - отдаем само слово
                                //TODO: translate: return false ??
                                if(need_str_def == '' || need_str_def == strundefined){
                                    warn("No default translated string [<"+this+">, translate."+translateObject+"] for language "+lang_default+"!");
                                    return this;
                                }
                                return translate[translateObject][lang_default];
                            } else {
                                return need_str;
                            }
                        }
                    }
                }

                return this;
            };

            /**
             * Translation
             **/
            app.config.f7_config.template7Data = {
                'url:speed.html':{
                    distance:'Distance'.translate(),
                    units: 'km'.translate()
                },
                'page:settings':{
                    title:'Settings'.translate(),
                    measureUnits:'Measure units'.translate(),
                    useGPS:'Use GPS'.translate(),
                    calibration:'Calibration'.translate(),
                    KM:'Kilometres'.translate(),
                    M:'Miles'.translate()
                }
            };

            if (app.config.f7_enable) {
                app.f7 = new Framework7(app.config.f7_config);
                app.view = app.f7.addView('.view-main', {
                    dynamicNavbar: true
                });
            }
            if (app.config.dom7_enable) {
                app.dom7 = Dom7;
            }

            /**
             * переводит число в радианы
             */
            if (typeof(Number.prototype.toRadians) === strundefined) {
                Number.prototype.toRadians = function () {
                    return this * Math.PI / 180;
                }
            }

            /**
             * Библиотека для работы с нативными функциями iOS и Android
             */
            if (app.config.JSAPI_enable) {
                app.JSAPI = JSAPI;
                app.log = function(log){
                    if(app.JSAPI.log){
                        app.JSAPI.log(log);
                    } else {
                        console.log.apply(console, arguments);
                    }
                };
                app.JSAPI.keepScreenOn();
            }

            if (app.isiPad()) {
                app.dom7('body').addClass('ipad');
            }
            app.free = app.dom7('body').hasClass('app-free');






            app.f7.onPageInit('*', function (page) {
                app.log('PAGE INIT' + page.name);
            });

            app.f7.onPageInit('speed', function (page) {
                app.pageInitSpeed(page);
            });

            app.f7.onPageInit('results', function (page) {
                app.pageInitResults(page);
            });

            app.f7.onPageInit('settings', function (page) {
                app.pageInitSettings(page);
            });

            app.f7.onPageBeforeAnimation('*', function (page) {
                if (page.name == 'index') {
                    app.pageIndexReinit(page);
                }
            });

            window.addEventListener('appCloseEvent', app.onhide);
            window.addEventListener('appMaximizeEvent', app.onrestore);

            app.loadingStart();
        },

        /**
         * метод вызывается при закрытии приложения
         */
        //TODO no JSAPI method
        ondestroy: function () {
        },

        /**
         * вызывается при сворачивании приложения
         * (при переходе в фоновый режим)
         */
        onhide: function () {
        },
        /**
         * - вызывается при восстановлении приложения
         * (если было скрыто)
         * - вызывается при запуске приложения
         */
        onrestore: function () {
        },

        log: console.log,
        warn: warn,
        /**
         * функция показа банера (в фри версии)
         * вызывается при инициализации каждой страницы
         * только для iOS
         */
        ad: function () {
            if (app.free && app.platform != 'android') {
                if (app.adTime) {
                    var now = new Date();
                    if (now.getTime() > app.adTime.getTime() + 2 * 60 * 1000) {
                        app.JSAPI.showAd();
                        app.adTime = new Date();
                    }
                } else {
                    app.adTime = new Date();
                }
            }
        },

        getStr: function (str) {
            if (typeof translate == 'undefined') {
                app.log("NO TRANSLATE OBJECT");
                return "#" + str;
            }
            /**
             if(translate[app.meta.language[app.meta.languageCurrent]] != undefined && translate[app.meta.language[app.meta.languageCurrent]][str] != undefined)  {
            return translate[app.meta.language[app.meta.languageCurrent]][str];
        } else {
            return translate[app.meta.language[app.meta.languageDefault]][str] || "#"+str;
        }**/

            if (typeof(translate[str]) != "undefined" && typeof(translate[str][app.meta.language[app.meta.languageCurrent]]) != "undefined") {
                return translate[str][app.meta.language[app.meta.languageCurrent]];
            } else {
                return translate[str][app.meta.language[app.meta.languageDefault]];
            }
        },
        translate: function () {
            var toTranslate = app.dom7('[data-translate]');
            var obj = null;
            for (var i = 0; i < toTranslate.length; i++) {
                obj = app.dom7(toTranslate[i]);
                obj.html(app.getStr(obj.dataset().translate));
            }
        },

        resizeNavbar: function(){
            app.f7.sizeNavbars('.view-main');
        },

        getLocalDB: function () {
            var db = localStorage.getItem("db");
            if (db == null) {
                db = "{}";
            }
            return JSON.parse(db);
        },
        setLocalDB: function (db) {
            localStorage.setItem("db", JSON.stringify(db));
        },

        getResult: function (index) {
            var db = app.getLocalDB();
            if (db.results != undefined) {
                return db.results[index];
            }
        },

        getResults: function () {
            var db = app.getLocalDB();
            if (db.results) return db.results; else return [];
        },

        setResults: function (results) {
            var db = app.getLocalDB();
            db.results = results;
            app.setLocalDB(db);
        },

        deleteResult: function (id) {
            var results = app.getResults();
            results.splice(id, 1);
            app.setResults(results);
        },

        deleteAllResults: function(){
            var db = app.getLocalDB();
            db.results = [];
            app.setLocalDB(db);
        },

        getTotalCount: function () {
            var db = app.getLocalDB();
            return db.totalCount || 0;
        },

        setTotalCount: function (num) {
            var db = app.getLocalDB();
            db.totalCount = num;
            app.setLocalDB(db);
        },

        increaseTotalCount: function (num) {
            var db = app.getLocalDB();
            if (db.totalCount == undefined)
                db.totalCount = 0;
            db.totalCount += num;
            app.setLocalDB(db);
        },

        openAnyPage: function () {
            app.translate();
            app.ad();
        },

        pageIndexInit: function () {
            //app.view.router.loadPage("settings.html");
            app.dom7('.text-push-to-start').text('Push to Start'.translate());
        },

        pageIndexReinit: function (page) {
            if (page.query.result) {
                var result = app.getResult(page.query.result);
                if(result){
                    app.dom7('.result-distance').text("You result - " + app.convertM2KM(app.GPSDistance(result.point0, result.point1)).toFixed(2) + "KM!");
                    app.dom7('.result-speed').text("Max speed: " + result.maxSpeed.toFixed() + "km/h");
                    app.dom7('.result').css('display', 'block');
                } else {
                    app.dom7('.result').css('display', 'none');
                }
            }
        },

        pageInitSpeed: function (page) {
            app.start();
            app.dom7('.button-stop').click(function () {
                app.stop();
            });
            app.dom7('.button-calibrate').click(function () {
                app.calibratePrepare();
            });
        },

        pageInitResults: function (page) {
            app.resultsBuild();
        },

        pageInitSettings: function () {
            app.dom7('.settings-calibration').click(function () {
                app.calibratePrepare();
            });

            app.dom7('.settings-units').on('change', function(){
                app.settingsSet('units', app.dom7('.settings-units').prop('value'));
            });

            if(app.settings.units == 'KM'){
                app.dom7('.units .item-after').text('Kilometres');
            } else {
                app.dom7('.units .item-after').text('Miles');
            }
            app.dom7('.settings-units').prop('value', app.settings.units);
        },

        resultsBuild: function () {
            var results = app.getResults();
            var date = '';
            var distance = '';
            var maxSpeed = '';
            if (results.length == 0) {
                app.dom7('.results .data').html('');
                app.dom7('.results .empty').css('display', 'block');
                app.dom7('.results-all-delete').css('display', 'none');
                app.resizeNavbar();
            } else {
                app.dom7('.results-all-delete').click(app.resultsDeleteAll);
                app.dom7('.results .data').html('');
                for (var i = 0; i < results.length; i++) {
                    date = new Date(results[i].date0).toLocaleDateString();
                    //TODO: сделать конвертацию в мили
                    distance = results[i].distance || 0;
                    maxSpeed = results[i].maxSpeed || 0;
                    app.dom7('.results .data').append(
                        '<li class="swipeout">' +
                        '<div class="swipeout-content">' +
                        '<div class="col">' + date + '</div>' +
                        '<div class="col">' + distance + '</div>' +
                        '<div class="col">' + maxSpeed + '</div>' +
                        '</div>' +
                        '<div class="swipeout-actions-right bg-red">' +
                        '<a href="#" class="action1" data-id="' + i + '"></a>' +
                        '</div>' +
                        '</li>');
                }

                app.dom7('.results .data a').click(function (e) {
                    app.deleteResult(app.dom7(e.target).dataset().id);
                    app.resultsBuild();
                });
            }
        },

        resultsDeleteAll: function(){
            app.f7.modal({
                text:'Вы уверены, что хотите удалить все результаты?'.translate(),
                buttons:[
                    {
                        text:'Да'.translate(),
                        onClick: function(){
                            app.deleteAllResults();
                            app.resultsBuild();
                        }
                    },
                    {
                        text:'Отмена'.translate()
                    }
                ]
            })

        },


        loadingStart: function () {

            app.settingsLoad();
            app.settingsApply();

            if (!app.loadingDisabled) {
                /**
                 * TODO: make real loading
                 **/
                setTimeout(app.loadingFinish, app.loadingFakeTime);//fake loading
            } else {
                app.loadingFinish();
            }
        },

        loadingFinish: function () {

            if(app.loadingDisabled){
                app.dom7(".loading-overlay").remove();
                app.pageIndexInit();
                return;
            }

            var overlay = app.dom7('.loading-overlay');
            overlay.css('transition-duration', app.loadingAnimationTime / 1000 + 's');
            overlay.css('opacity', 0);
            overlay.css('top', '-1000px');
            setTimeout(function () {
                app.dom7(".loading-overlay").remove();
            }, app.loadingAnimationTime);
            app.pageIndexInit();
        },

        GPSInit: function () {
            if (app.platform == 'android') {
                app.JSAPI.listenLocation(500, 0, 'network');
            } else {
                app.JSAPI.listenLocation(500, 0, 'gps');
            }
            window.addEventListener('locationChangedEvent', app.GPSListener);
            /*
             navigator.geolocation.watchPosition(function(position){
             app.GPSWatch(position.coords);
             });
             */

        },

        GPSListener: function () {
            app.GPSWatch(getBufferEventVar());
        },

        GPSWatch: function (position) {
            if (app.startCoordinates === null) {
                app.startCoordinates = position;
                app.maxSpeed = position.speed;
            }

            if (position.speed > app.maxSpeed) {
                app.maxSpeed = position.speed;
            }

            app.updatePosition(position);

        },

        GPSOn: function () {
            app.GPSInit();
        },
        GPSOff: function () {
            app.JSAPI.stopListenLocation();
            window.removeEventListener('locationChangedEvent', app.GPSListener);
        },

        deviceMotionInit: function () {
            window.addEventListener('devicemotion', function (e) {
                app.calcDistanceByAcceleration(e.acceleration);
            }, true);
        },
        calcDistanceByAcceleration: function (acc1) {
            var dX = 0, dY = 0, dZ = 0;
            var acc0 = app.motionAccelerationOld;
            var dist = 0;

            dX = Math.abs(acc0.x - acc1.x);
            dY = Math.abs(acc0.y - acc1.y);
            dZ = Math.abs(acc0.z - acc1.z);

            dist = Math.sqrt(dX * dX + dY * dY + dZ * dZ);

            app.motionAccelerationOld = acc1;

            if (dist < 1) return;

            app.distanceAcc += dist;
            app.updateSensors();
            app.increaseTotalCount(dist);
        },

        updatePosition: function (position) {
            app.distanceCount(position);

            app.lastCoordinates = position;

            app.speedChange(position.speed);

            app.updateSensors();
        },

        distanceCount: function (currentCoordinates) {
            if (app.lastCoordinates == null) {
                app.distance = 0;
                return;
            }
            var distance = Math.round(app.GPSDistance(app.lastCoordinates, currentCoordinates));
            app.distance += distance;
            app.increaseTotalCount(distance);
        },

        accelerometerInit: function () {
            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', app.accelerometerWatch, false);
            }
        },

        accelerometerWatch: function (rotation) {
            if (app.startAngleA === null) {
                app.accelerometerCalibrate(rotation);
            }

            app.dom7('.angle-beta-inner').css({
                'transform': 'rotate(' + Math.round(rotation.beta) + 'deg)',
                '-webkit-transform': 'rotate(' + Math.round(rotation.beta) + 'deg)'
            });

            app.dom7('.angle-gamma-inner').css({
                'transform': 'rotate(' + Math.round(rotation.gamma) + 'deg)',
                '-webkit-transform': 'rotate(' + Math.round(rotation.gamma) + 'deg)'
            });
        },

        accelerometerCalibrate: function (angle) {
            app.startAngleA = angle.alpha;
            app.startAngleB = angle.beta;
            app.startAngleG = angle.gamma;
        },

        /**
         * функция вызывается при первом запуске приложения на устройстве
         */
        firstLaunch: function () {

        },
        settingsLoad: function () {
            var db = app.getLocalDB();
            var settings = db.settings || app.settingsDefault;
            if (!settings.notFirstLaunch || settings.notFirstLaunch == undefined) {
                app.firstLaunch();
                settings.notFirstLaunch = true;
            }
            app.settings = settings;
            app.settingsSave();
        },
        settingsSave: function () {
            var db = app.getLocalDB();
            db.settings = app.settings;
            app.setLocalDB(db);
        },
        settingsSet: function (param, value) {
            app.settings[param] = value;
            app.settingsSave();
        },
        settingsApply: function () {

        },
        indexOfKey: function (arr, search) {
            var i = 0;
            for (var key in arr) {
                if (key == search)
                    return i;
                i++;
            }
            return -1;
        },
        indexOfVal: function (arr, search) {
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] == search)
                    return i;
            }
            return -1;
        },

        isiPad: function () {
            return navigator.userAgent.match(/(iPad).*OS\s([\d_]+)/) != null;
        },

        alert: function (text) {
            app.f7.alert(text, app.meta.title);
        },

        /**
         * Вычисляет расстояние между двумя точками (в метрах)
         * @param coord1 - координаты 1 точки {longitude:0, latitude:0}
         * @param coord2 - координаты 2 точки {longitude:0, latitude:0}
         * @returns {number}
         * @constructor
         */
        GPSDistance: function (coord1, coord2) {

            if (coord1 == undefined && coord2 == undefined) return -1;

            var lat1 = coord1.latitude;
            var lat2 = coord2.latitude;
            var lon1 = coord1.longitude;
            var lon2 = coord2.longitude;

            var R = 6371000; // Earth radius in metres
            var f1 = lat1.toRadians();
            var f2 = lat2.toRadians();
            var df = (lat2 - lat1).toRadians();
            var dl = (lon2 - lon1).toRadians();

            var a = Math.sin(df / 2) * Math.sin(df / 2) +
                Math.cos(f1) * Math.cos(f2) *
                Math.sin(dl / 2) * Math.sin(dl / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            return R * c;
        },

        start: function () {
            app.distance = 0;
            app.startDate = new Date();
            app.distanceAcc = 0;
            app.maxSpeed = null;
            if (app.settings.distanceByGPS) {
                // calculate distance by GPS
                app.GPSOn();
            } else {
                // calculate distance by acceleration
                app.deviceMotionInit();
            }
            app.accelerometerInit();
        },

        stop: function () {
            app.GPSOff();
            var result_index = app.saveResult();
            app.maxSpeed = null;
            app.startCoordinates = null;
            app.startDate = null;
            app.view.router.back({
                url:"index.html?result="+ result_index,
                force:true
            });
            //app.view.router.loadPage("index.html?result=" + result_index);
        },

        /**
         * Metres per Second to KM's per Hour
         * @param MPS
         * @returns {number}
         */
        speedMPS2KMPH: function (MPS) {
            return Math.floor((MPS * 60 * 60) / 1000);
        },

        speedToCSSDeg: function (speed) {
            var maxSpeed = app.maxSpeedKM;
            if (app.settings.units == 'M') {
                maxSpeed = app.maxSpeedM;
                speed = app.speedMPS2KMPH(speed);//TODO: convert to miles!
            } else {
                speed = app.speedMPS2KMPH(speed);
            }
            var minAngle = -101;
            var maxAngle = 101;

            if (speed > maxSpeed) {
                speed = maxSpeed;
            }
            if (speed < 0) {
                speed = 0;
            }

            var anglePS = (Math.abs(minAngle) + maxAngle) / maxSpeed;

            var angle = speed * anglePS;

            return -(Math.abs(minAngle) - angle);
        },

        convertM2KM: function (m) {
            return m / 1000;
        },

        saveResult: function () {
            var db = app.getLocalDB();
            if (app.startCoordinates == null) {
                app.startCoordinates = {};
                app.startCoordinates.longitude = 0;
                app.startCoordinates.latitude = 0;
            }
            if (app.lastCoordinates == null) {
                app.lastCoordinates = {};
                app.lastCoordinates.longitude = 0;
                app.lastCoordinates.latitude = 0;
            }
            var result = {
                date0: app.startDate,
                date1: new Date(),
                point0: {longitude: app.startCoordinates.longitude, latitude: app.startCoordinates.latitude},
                point1: {longitude: app.lastCoordinates.longitude, latitude: app.lastCoordinates.latitude},
                maxSpeed: app.maxSpeed || 0,
                distance: app.distance || 0,
                distanceAcc: app.distAcc || 0
            };

            var result_index = 0;

            if (db.results == undefined) {
                db.results = [result];
            } else {
                result_index = db.results.length;
                db.results.push(result);
            }

            app.setLocalDB(db);

            return result_index;
        },

        speedChange: function (speed) {
            if (typeof(speed) != "number") speed = 0;
            speed = Math.abs(speed);
            app.dom7('.speedometer-arrow').css('transform', 'rotate(' + app.speedToCSSDeg(speed) + 'deg)');
            app.dom7('.speedometer-arrow').css('-webkit-transform', 'rotate(' + app.speedToCSSDeg(speed) + 'deg)');
            app.dom7('.speedometer-digital').text(app.speedMPS2KMPH(speed));
            app.log(app.speedMPS2KMPH(speed));
        },

        updateSensors: function () {
            if (app.settings.distanceByGPS) {
                app.dom7('.distance').text(app.convertM2KM(app.distance).toFixed(2));
            } else {
                app.dom7('.distance').text(app.convertM2KM(app.distanceAcc).toFixed(2));
            }
            app.dom7('.distance-total').text(app.getTotalCount());
        },

        calibratePrepare: function () {
            app.f7.modal({
                title: 'Калибровка'.translate(),
                text: 'Закрепите устройство и нажмите Продолжить для начала калибровки'.translate(),
                buttons: [
                    {
                        text: 'Продолжить'.translate(),
                        bold: true,
                        onClick: function () {
                            app.calibrateModal();
                        }
                    },
                    {
                        text: 'Отмена'.translate()
                    }
                ]
            });
        },

        calibrateModal: function () {

            app.calibrate();

            app.f7.modal({
                title: 'Пожалуйста подождите..'.translate(),
                text: '<div class="calibration"></div>'
            });

            setTimeout(function () {
                app.f7.closeModal();
                app.f7.modal({
                    title: 'Калибровка завершена!'.translate(),
                    buttons: [
                        {text: 'Ок'.translate()}
                    ]
                });
                setTimeout(app.f7.closeModal, 2000);
            }, 1000);
        },

        calibrate: function () {
            //TODO: make calibration
        }
    };
    document.addEventListener('DOMContentLoaded', app.init);
}());