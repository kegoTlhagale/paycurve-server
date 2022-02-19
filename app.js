require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cookieParser());

// importing user context
const User = require("./model/user");
const auth = require("./middleware/auth");

const corsOptions = {
  origin: `http://localhost:${process.env.VUE_PORT}`,
  credentials: true,  //access-control-allow-credentials:true
  optionSuccessStatus: 200
}
app.use(cors(corsOptions));

//Register
app.post("/register", async (req, res) => {
    const { user_name, email, password } = req.body;

    // Validate user input
    if (!(email && password && user_name)) {
      return res.status(400).json({
        success: false,
        message: "All input is required",
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
                console.log("findOne error", error);
        
                return res.status(500).json({
                  success: false,
                  message: "Something went wrong. Please try again later",
                });
              }
        
              // if user exists, inform user to login instead
              if (existingUser) {
                return reject({
                status: 409,
                  message: "User already exists. Please login",
                });
              }

              // if user doea=s not exist, proceed to create user
              return resolve()       
        })
    })
    .then(() => new Promise(async (resolve, reject) => {
        //Encrypt user password
        const encryptedPassword = await bcrypt.hash(password, 10);

        // Create user in our database
        User.create({
            user_name,
            email: email.toLowerCase(), // sanitize: convert email to lowercase
            password: encryptedPassword,
          }, (error, savedUser) => {
            if (error) {
                console.log("create error", error);
        
                return reject({
                    success: false,
                    message: "Something went wrong. Please try again later",
                })
            } else {
                const token = jwt.sign(
                    { user_id: savedUser._id, email },
                    process.env.TOKEN_KEY
                );
    
                savedUser = token;
                resolve({
                  user: savedUser,
                  token
                })
            }
        })
    }))
    .then((savedUser) => {
      console.log('User registration successful')

      const { user, token } = savedUser
      return res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "test",
      })
      .status(200).json({
          success: true,
          data: user
      })
    })
    .catch((error) => {
      console.log('User registration failed')
        return res.status(error.status || 500).json({
            sucess: false,
            message: error.message || 'Something went wrong. Please try again later'
        }) 
    })
})

//Login
app.post("/login", (req, res) => {
  // our login logic goes here
  try {
    // Get user input
    const { email, password } = req.body;

    // Validate user input
    if (!(email && password)) {
      return res.status(400).json({
        success: false,
        message: "All input is required",
      });
    }

    // Validate if user exist in our database
    User.findOne({ email }, async (error, registeredUser) => {
      if (error) {
        console.log("findOne error", error);

        return res.status(500).json({
          success: false,
          message: "Something went wrong. Please try again later",
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
            message: "Invalid Credentials",
          });
        }

        // if password is correct, Create token
        const token = jwt.sign(
          { user_id: registeredUser._id, email },
          process.env.TOKEN_KEY
        );

        console.log('User login successful')
        // user
        return res
        .cookie("access_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "test",
        })
        .status(200).json({
          success: true,
          data: registeredUser,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "User with the email address does not exist. Please register",
        });
      }
    });
  } catch (err) {
    console.log('User login failed')

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later",
    });
  }
  // Our register logic ends here
});

// logout
app.post("/logout", (req, res) => {
  console.log('User logout successful')

  return res
    .clearCookie("access_token")
    .status(200)
    .json({ message: "Successfully logged out 😏 🍀" });
});

app.get("/welcome", auth, (req, res) => {
  res.status(200).send({ message: "Welcome " });
  // logic to connect to weather or any open api
});

module.exports = app;
