const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const app = express();
const cors = require("cors");
const UserDetails = require("./models/userdetails.js");
const jwt = require("jsonwebtoken");
const SaleDetails = require("./models/Saledetails.js");
const cookieParser = require("cookie-parser");
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
};
app.use(cors(corsOptions));

app.use(cookieParser());
app.use(bodyParser.json());
app.listen(5000, function initialize() {
  console.log("Server connected");
});

mongoose
  .connect(
    "MongoDBConnection=mongodb://localhost:27017;"
  )
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err.message);
  });

//.......jwtverification middleware.........
const verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }

  jwt.verify(token, "devsharma", (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "invalidtoken" });
    }

    req.userId = decoded.userId; // Add the userId to the request object
    next(); // Proceed to the next middleware or route
  });
};

// Endpoint to handle user registration
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await UserDetails.findOne({email });
    if (existingUser) {
      return res.status(400).json({ message: "userexists" });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user record in the database
      const newUser = await UserDetails.create({
        name: name,
        email: email,
        password: hashedPassword,
      });

      return res.status(200).json({ message: "usercreated" });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
});

// .....login......
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserDetails.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "usernotfound" });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "incorrectpassword" });
    }
    const { password: userPassword, ...sanitizedUser } = user;
    const token = jwt.sign({ userId: user._id }, "devsharma");
    res.cookie("accessToken", token, {
      httpOnly: true,
      sameSite: "strict",
    });
    return res.status(200).json({ message: "loginsuccessful" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
});

//.........logout........
app.get("/logout", (req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    expires: new Date(0), // Set expiration date to past to delete the cookie
  });
  returnres.status(200).json({ message: "Logged out successfully" });
});

// ..........addsales......
app.post("/addsale", verifyToken, async (req, res) => {
  try {
    const { productName, productQuantity, productAmount } = req.body;
    const userId = req.userId; // Retrieve userId from the request object
    if (productName && productQuantity && productAmount && userId) {
      const latestSale = await SaleDetails.findOne(
        { userId },
        {},
        { sort: { saleNumber: -1 } }
      );

      let saleNumber = 1;

      if (latestSale && latestSale.saleNumber) {
        saleNumber = latestSale.saleNumber + 1;
      }
      const sale = await SaleDetails.create({
        productName,
        productQuantity,
        productAmount,
        userId,
        saleNumber,
      });
      console.log("saleadded");
      return res.status(200).json({ message: "saleadded" });
    } else {
      console.log("badrequest");
      return res.status(400).json({ message: "badrequest" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
});

// ..........Top 5 SaleDetails........
app.get("/topsales", verifyToken, async (req, res) => {
  try {
    const userId = req.userId; // Retrieve userId from the request object
    const oneDayAgo = new Date(Date.now() - 24*60*60*1000); // 24 hours ago

    if (userId) {
      const topSales = await SaleDetails.find(
        { 
          userId,
          createdAt: { $gte: oneDayAgo } // sales within the last 24 hours
        },
        {},
        { sort: { productAmount: -1} } // sort by productAmount in descending order
      ).limit(5); // limit to top 5 sales

      console.log("Top sales fetched");
      return res.status(200).json({ message: "Top sales fetched", topSales });
    } else {
      console.log("Bad request");
      return res.status(400).json({ message: "Bad request" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
});

// .....todays total revenue...
app.get('/totalrevenue', verifyToken, async(req,res)=>{
  try {
    const userId = req.userId; // Retrieve userId from the request object
    const oneDayAgo = new Date(Date.now() - 24*60*60*1000); // 24 hours ago

    if (userId) {
      const sales = await SaleDetails.find(
        { 
          userId,
          createdAt: { $gte: oneDayAgo } // sales within the last 24 hours
        }
      ); 

      let totalRevenue = 0;
      sales.forEach(sale => {
        totalRevenue += sale.productAmount; // add up the productAmount of each sale
      });

      console.log("Total revenue fetched");
      return res.status(200).json({ message: "Total revenue fetched", totalRevenue });
    } else {
      console.log("Bad request");
      return res.status(400).json({ message: "Bad request" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
});