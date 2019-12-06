const express = require('express');
const Guid = require('../models/guid');
const router = express.Router();
const catchErrors = require('../lib/async-error');

function needAuth(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.flash('danger', 'Please signin first.');
    res.redirect('/guid_signin');
  }
}

function validateForm(form, options) {
  var name = form.name || "";
  var email = form.email || "";
  name = name.trim();
  email = email.trim();

  if (!name) {
    return 'Name is required.';
  }

  if (!email) {
    return 'Email is required.';
  }

  if (!form.password && options.needPassword) {
    return 'Password is required.';
  }

  if (form.password !== form.password_confirmation) {
    return 'Passsword do not match.';
  }

  if (form.password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  return null;
}

/* GET users listing. */
router.get('/', needAuth, catchErrors(async (req, res, next) => {
  const guids = await Guid.find({});
  res.render('guids/index', {guids: guids});
}));

router.get('/new', (req, res, next) => {
  res.render('guids/new', {messages: req.flash()});
});

router.get('/:id/edit', needAuth, catchErrors(async (req, res, next) => {
  const guid = await Guid.findById(req.params.id);
  res.render('guids/edit', {guid: guid});
}));

router.put('/:id', needAuth, catchErrors(async (req, res, next) => {
  const err = validateForm(req.body);
  if (err) {
    req.flash('danger', err);
    return res.redirect('back');
  }

  const guid = await Guid.findById({_id: req.params.id});
  if (!guid) {
    req.flash('danger', 'Not exist user.');
    return res.redirect('back');
  }

  if (!await guid.validatePassword(req.body.current_password)) {
    req.flash('danger', 'Current password invalid.');
    return res.redirect('back');
  }

  guid.name = req.body.name;
  guid.email = req.body.email;
  if (req.body.password) {
    guid.password = await guid.generateHash(req.body.password);
  }
  await guid.save();
  req.flash('success', 'Updated successfully.');
  res.redirect('/guids');
}));

router.delete('/:id', needAuth, catchErrors(async (req, res, next) => {
  const guid = await Guid.findOneAndRemove({_id: req.params.id});
  req.flash('success', 'Deleted Successfully.');
  res.redirect('/guids');
}));

router.get('/:id', catchErrors(async (req, res, next) => {
  const guid = await Guid.findById(req.params.id);
  res.render('guids/show', {guid: guid});
}));

router.post('/', catchErrors(async (req, res, next) => {
  var err = validateForm(req.body, {needPassword: true});
  if (err) {
    req.flash('danger', err);
    return res.redirect('back');
  }
  var guid = await Guid.findOne({email: req.body.email});
  console.log('USER???', guid);
  if (guid) {
    req.flash('danger', 'Email address already exists.');
    return res.redirect('back');
  }
  guid = new Guid({
    name: req.body.name,
    email: req.body.email,
  });
  guid.password = await guid.generateHash(req.body.password);
  await guid.save();
  req.flash('success', 'Registered successfully. Please sign in.');
  res.redirect('/');
}));

module.exports = router;
