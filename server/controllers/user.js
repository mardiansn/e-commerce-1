const User = require('../models/user')
const { comparePass } = require('../helpers/bcrypt')
const { verifyToken, genToken } = require('../helpers/jwt')
const { ObjectId } = require('mongoose').Types
const { OAuth2Client } = require('google-auth-library')

class UserController {
  static register (req, res, next) {
    const { username, email, password } = req.body
    User.create({ username, email, password})
      .then(user => {
        res.status(201).json({ message: 'Successfully registered', user })
      })
      .catch(next)
  }
  static adminRegister (req, res, next) {
    const { username, email, password} = req.body
    const role = 'admin'
    User.create( { username, email, password, role })
      .then( user => {
        res.status(201).json({ message: 'Successfully registered admin', user })
      })
      .catch(next)

  }
  static login (req, res, next) {
    const { email,  password } = req.body
    User.findOne({ email })
      .then(user => {
        if(user && comparePass(password, user.password)){
          const token = genToken({ id: user._id, role: user.role })
          res.status(200).json({ message: 'Welcome back!', token, id: user._id })
        } else {
          next({ status: 400, message: { message: 'Invalid email/password'}})
          // res.status(400).json({ message: 'Invalid email/password'})
        }
      })
      .catch(next)
  }
  static gLogin (req, res, next) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

    const { id_token } = req.body
    let userData

    client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    })
    .then(ticket => {
      const gPayload = ticket.getPayload()
      const { email, name } = gPayload
      userData = { email, username:name }
      return User.findOne({ email })
    })
    .then(user => {
      if(user){
        const token = genToken({id: user._id, role: user.role })
        res.status(200).json({ token })
      } else {
        userData.password = 'password123'
        return User.create(userData)
        .then(user=> {
          const token = genToken({id: user._id, role: user.role})
          res.status(200).json({ token, message: 'Welcome back!' })
        })
      }
    })
    .catch(next)
  }
  static verify (req, res, next) {
    try {
      verifyToken(req.headers.token)
      res.status(200).json({ message: 'User verified' })
    }
    catch(err) {
      next(err)
    }
  }
  static verifyAdmin (req, res, next) {
    try{
      const decoded = verifyToken(req.headers.token)
      if(decoded.role === 'admin') {
        res.status(200).json({ message: 'Admin verified'})
      } else {
        next({ status: 403, message: { message: 'Verification failed' }})
      }
    }
    catch(err) {
      next(err)
    }
  }
  static getCart (req, res, next) {
    const { id } = req.loggedUser
    User.findById(id).populate('cart.product')
      .then(user => {
        res.status(200).json(user)
      })
      .catch(next)
  }
  static updateCart (req, res, next) {
    const { cart } = req.body
    cart.product = ObjectId(cart.product)
    const { id } = req.loggedUser
    User.findByIdAndUpdate(id , { cart }).populate('cart.product')
      .then(user => {
        res.status(200).json({ user, message: 'Successfully update cart'})
      })
      .catch(next)
  }
  static checkout (req, res, next ) {
    const cart = []
    const { id } = req.loggedUser
    User.findByIdAndUpdate(id, { cart }).populate('cart.product')
      .then(user => {
        res.status(200).json({ user, message: 'Successfully checkout'})
      })
      .catch(next)
  }
  static deleteFromCart (req, res, next) {
    const { id } = req.params
    const userId = req.loggedUser.id
    User.findByIdAndUpdate(userId, { $pull: { cart: { _id: id }}}).populate('cart.product')
      .then(user => {
        res.status(200).json({ user, message: 'Successfully deleted item from cart'})
      })
      .catch(next)
  }
}

module.exports = UserController