const Catch = require('../models/Catch');
const User = require('../models/User');
const notify = require('./oneSignalController');
const Winner = require('../models/Winner');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

exports.addCatch = async (req, res) => {
    const { name, email, images, location, basePrice, quantity, startTime, endTime } = req.body;

    try {
        const user = await User.findOneAndUpdate({ email }, {}, { upsert: true, new: true });

        const imagePaths = await Promise.all(images.map(async (image, i) => {
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `image_${Date.now()}_${i}.png`;
            const dirPath = path.join(__dirname, '../../uploads', user.id);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            const imagePath = path.join(dirPath, filename);
            await fs.promises.writeFile(imagePath, buffer);
            return `/uploads/${user.id}/${filename}`;
        }));

        const catchObj = new Catch({
            name,
            images: imagePaths,
            location,
            basePrice,
            currentBid: basePrice,
            quantity,
            startTime,
            endTime,
            seller: user.id,
            status: 'available'
        });

        await catchObj.save();
        const imgUrl = `${process.env.SURL}${imagePaths[0]}`;
        notify.sendNotificationToAllPlayers("New Catch Added", name, imgUrl);
        res.status(201).json({ msg: 'Catch added successfully' });
    } catch (error) {
        console.error('Error adding catch:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};


exports.getCatchesBySeller = async (req, res) => {
    const id = req.params.id;
    try {
        const catches = await Catch.find({ seller: id }).populate('seller', 'name email'); // Populate the seller details
        res.json(catches);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getAllCatches = async (req, res) => {
    try {

        const catches = await Catch.find({ status: "available" }).populate('seller', 'name email');

        res.json(catches);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server error' });
    }
};


exports.getCatchById = async (req, res) => {
    const catchId = req.params.id;

    try {
        const catchObj = await Catch.findById(catchId).populate('seller', 'name email'); // Populate the seller details

        if (!catchObj) {
            return res.status(404).json({ msg: 'Catch not found' });
        }

        // Check if there's a highestBidder field
        if (catchObj.highestBidder) {
            const user = await User.findById(catchObj.highestBidder);
            if (user) {
                // Replace highestBidder with the username
                catchObj.highestBidder = user.username;
            }
        }

        res.json(catchObj);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.editCatch = async (req, res) => {
    const catchId = req.params.id;
    const { name, images, location, basePrice, quantity, startTime, endTime } = req.body;

    try {
        let catchObj = await Catch.findById(catchId);

        if (!catchObj) {
            return res.status(404).json({ msg: 'Catch not found' });
        }

        // Update catch details
        catchObj.name = name;
        catchObj.location = location;
        catchObj.basePrice = basePrice;
        catchObj.quantity = quantity;
        catchObj.startTime = startTime;
        catchObj.endTime = endTime;

        await catchObj.save();

        res.json({ msg: 'Catch updated successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.deleteCatch = async (req, res) => {
    const catchId = req.params.id;

    try {
        const catchObj = await Catch.findById(catchId);

        if (!catchObj) {
            return res.status(404).json({ msg: 'Catch not found' });
        }

        // Retrieve the array of image locations
        const imageLocations = catchObj.images;

        // Iterate over each image location and delete the corresponding image file
        imageLocations.forEach(imageLocation => {
            const dirPath = path.join(__dirname, '../../', imageLocation);
            // Check if the image file exists before attempting to delete it
            if (fs.existsSync(dirPath)) {
                fs.unlinkSync(dirPath);
            }
        });

        await Catch.findByIdAndDelete(catchId);

        res.json({ msg: 'Catch deleted successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

// Route to get the list of catches won by the buyer
exports.getWonCatches = async (req, res) => {
    try {
      const buyerId = req.params.buyerId;
  
      // Find all catches won by the buyer
      const winnerCatches = await Winner.find({ winnerId: buyerId }).populate('catchId');
  
      // Extract relevant information about the won catches
      const wonCatches = winnerCatches.map(winner => winner.catchId);
      //console.log(wonCatches);
  
      res.json(wonCatches);
    } catch (error) {
      console.error("Error fetching won catches:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getSellerByCatchId = async (req, res) => {
    const catchId = req.params.id;

    try {
        const catchObj = await Catch.findById(catchId);

        if (!catchObj) {
            return res.status(404).json({ msg: 'Catch not found' });
        }

        const sellerId = catchObj.seller;

        if (!sellerId) {
            return res.status(404).json({ msg: 'Seller not found for this catch' });
        }

        // Sending both sellerId and catchId in the response
        res.json({ seller: sellerId, catchId: catchObj._id });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: 'Server error' });
    }
};
