require('dotenv').config();
require('./config/database').connect();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const weather = require('openweather-apis');

// Set the language to english
weather.setLang('en');

weather.setAPPID('92c89236f6fe9a73bf673ccaaaf28fe9');

const app = express();
app.use(express.json());
app.use(cookieParser());

// importing user context
const User = require('./model/user');
const Alert = require('./model/alert');
const auth = require('./middleware/auth');

const corsOptions = {
    origin: `http://localhost:${process.env.VUE_PORT}`,
    credentials: true, //access-control-allow-credentials:true
    optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

//Register
app.post('/register', async (req, res) => {
    const { user_name, email, password } = req.body;

    // Validate user input
    if (!(email && password && user_name)) {
        return res.status(400).json({
            success: false,
            message: 'All input is required',
        });
    }

    /* Promise chain that does the following
    - check if the user exists
    - if user exists, notify user to login instead
    - if user does not exist, create the user
    - return the user as a response 
    */

    return new Promise((resolve, reject) => {
        //check if the user exists
        User.findOne({ email }, (error, existingUser) => {
            if (error) {
                console.log('findOne error', error);

                return res.status(500).json({
                    success: false,
                    message: 'Something went wrong. Please try again later',
                });
            }

            // if user exists, inform user to login instead
            if (existingUser) {
                return reject({
                    status: 409,
                    message: 'User already exists. Please login',
                });
            }

            // if user doea=s not exist, proceed to create user
            return resolve();
        });
    })
        .then(
            () =>
                new Promise(async (resolve, reject) => {
                    //Encrypt user password
                    const encryptedPassword = await bcrypt.hash(password, 10);

                    // Create user in our database
                    User.create(
                        {
                            user_name,
                            email: email.toLowerCase(), // sanitize: convert email to lowercase
                            password: encryptedPassword,
                        },
                        (error, savedUser) => {
                            if (error) {
                                console.log('create error', error);

                                return reject({
                                    success: false,
                                    message:
                                        'Something went wrong. Please try again later',
                                });
                            } else {
                                const token = jwt.sign(
                                    { user_id: savedUser._id, email },
                                    process.env.TOKEN_KEY
                                );

                                savedUser = token;
                                resolve({
                                    user: savedUser,
                                    token,
                                });
                            }
                        }
                    );
                })
        )
        .then((savedUser) => {
            console.log('User registration successful');
            delete savedUser['password'];

            const { user, token } = savedUser;
            return res
                .cookie('access_token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'test',
                })
                .status(200)
                .json({
                    success: true,
                    data: user,
                });
        })
        .catch((error) => {
            console.log(`User registration failed \n`, error);
            return res.status(error.status || 500).json({
                sucess: false,
                message:
                    error.message ||
                    'Something went wrong. Please try again later',
            });
        });
});

//Login
app.post('/login', (req, res) => {
    // our login logic goes here
    try {
        // Get user input
        const { email, password } = req.body;

        // Validate user input
        if (!(email && password)) {
            return res.status(400).json({
                success: false,
                message: 'All input is required',
            });
        }

        // Validate if user exist in our database
        User.findOne({ email }, async (error, registeredUser) => {
            if (error) {
                console.log('findOne error', error);

                return res.status(500).json({
                    success: false,
                    message: 'Something went wrong. Please try again later',
                });
            }

            // check if the passwords match
            if (registeredUser) {
                const passwordCorrect = await bcrypt.compare(
                    password,
                    registeredUser.password
                );

                // alert user if the password is incorrect
                if (!passwordCorrect) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid Credentials',
                    });
                }

                // if password is correct, Create token
                const token = jwt.sign(
                    { user_id: registeredUser._id, email },
                    process.env.TOKEN_KEY
                );

                console.log('User login successful');
                // user
                delete registeredUser['password'];

                return res
                    .cookie('access_token', token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'test',
                    })
                    .status(200)
                    .json({
                        success: true,
                        data: registeredUser,
                    });
            } else {
                return res.status(400).json({
                    success: false,
                    message:
                        'User with the email address does not exist. Please register',
                });
            }
        });
    } catch (error) {
        console.log(`User login failed \n`, error);

        return res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again later',
        });
    }
    // Our register logic ends here
});

// logout
app.post('/logout', (req, res) => {
    console.log('User logout successful');

    return res
        .clearCookie('access_token')
        .status(200)
        .json({ message: 'Successfully logged out 😏 🍀' });
});

// get the weather forecast for an area specified by the user
app.post('/get-weather', (req, res) => {
    const { area } = req.body;
    const information = {};

    // Validate user input
    if (area === '') {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid city',
        });
    }

    // set city
    weather.setCity(area);

    // get a simple JSON Object with temperature, humidity, pressure and description
    weather.getSmartJSON(function (err, smart) {
        information.smart = smart;

        if (Object.keys(information).length === 0) {
          return res
              .status(400)
              .send({
                  success: false,
                  message:
                      'Could not retrieve data. Please make sure you entered a valid city',
              });
        }

        res.status(200).send({ success: true, data: information });
    });
});

// add weather notice
app.post('/alert',  (req, res) => {
  try {
  const { message, city } = req.body;
    // validate that the message is not empty
    if (message === '') {
        return res.status(400).json({
            success: false,
            message: 'The alert must not be empty.',
        });
    }

        // validate that the message is not empty
    if (city === '') {
      return res.status(400).json({
          success: false,
          message: 'The city/area must not be empty.',
      });
    }
  
    // validate the the message is at least 5 words long
    if (message.split(' ').length < 4) {
        return res.status(400).json({
            success: false,
            message: 'The alert must include at least 5 words.',
        });
    }

    // save the message to the db
    Alert.create(
      {
       message: message.toLowerCase(), // sanitize: convert message to lowercase
       city: city.toLowerCase(), // sanitize: convert message to lowercase
      },
      (error) => {
        if (error) {
          console.log('create error', error);

          return res.status(500).json({
              success: false,
              message: 'Something went wrong. Please try again later',
          });
        }
          
        return res.status(200).send({ success: true });
      }
    );
  } catch (error) {
      console.log(`User login failed \n`, error);

      return res.status(500).json({
          success: false,
          message: 'Something went wrong. Please try again later',
      });
  }
});

app.get('/get-alert',  (req, res) => {
  try {
  const { city } = req.query;

    //  get alert by city
    Alert.findOne({ city }, async (error, alert) => {
      if (error) {
          console.log('findOne error', error);

          return res.status(500).json({
              success: false,
              message: 'Something went wrong. Please try again later',
          });
      }

      if (alert) {
        return res
        .status(200)
        .json({
            success: true,
            data: { message: alert.message }
        });
      }
    });
  } catch (error) {
      console.log(`User login failed \n`, error);

      return res.status(500).json({
          success: false,
          message: 'Something went wrong. Please try again later',
      });
  }
});

module.exports = app;
