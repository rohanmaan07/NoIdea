const User = require('../models/User');
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};
const createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    const user = await User.create({ name, email });

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser,
};

