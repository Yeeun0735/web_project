const express = require('express');
const Tour = require('../models/tour');
const Answer = require('../models/answer'); 
const catchErrors = require('../lib/async-error');


module.exports = io => {
  const router = express.Router();
  
  // 동일한 코드가 users.js에도 있습니다. 이것은 나중에 수정합시다.
  function needAuth(req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.flash('danger', 'Please signin first.');
      res.redirect('/guid_signin');
    }
  }

  /* GET tour listing. */
  router.get('/', catchErrors(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    var query = {};
    const term = req.query.term;
    if (term) {
      query = {$or: [
        {title: {'$regex': term, '$options': 'i'}},
        {content: {'$regex': term, '$options': 'i'}}
      ]};
    }
    const tours = await Tour.paginate(query, {
      sort: {createdAt: -1}, 
      populate: 'author', 
      page: page, limit: limit
    });
    res.render('tours/index', {tours: tours, term: term, query: req.query});
  }));

  router.get('/new', needAuth, (req, res, next) => {
    res.render('tours/new', {tour: {}});
  });

  router.get('/:id/edit', needAuth, catchErrors(async (req, res, next) => {
    const tour = await Tour.findById(req.params.id);
    res.render('tours/edit', {tour: tour});
  }));

  router.get('/:id', catchErrors(async (req, res, next) => {
    const tour = await Tour.findById(req.params.id).populate('author');
    const answers = await Answer.find({tour: tour.id}).populate('author');
    tour.numReads++;    // TODO: 동일한 사람이 본 경우에 Read가 증가하지 않도록???

    await tour.save();
    res.render('tours/show', {tour: tour, answers: answers});
  }));

  router.put('/:id', catchErrors(async (req, res, next) => {
    const tour = await Tour.findById(req.params.id);

    if (!tour) {
      req.flash('danger', 'Not exist tour');
      return res.redirect('back');
    }
    tour.title = req.body.title;
    tour.name = req.body.name;
    tour.price = req.body.price;
    tour.content = req.body.content;
    tour.tags = req.body.tags.split(" ").map(e => e.trim());

    await tour.save();
    req.flash('success', 'Successfully updated');
    res.redirect('/tours');
  }));

  router.delete('/:id', needAuth, catchErrors(async (req, res, next) => {
    await Tour.findOneAndRemove({_id: req.params.id});
    req.flash('success', 'Successfully deleted');
    res.redirect('/tours');
  }));

  router.post('/', needAuth, catchErrors(async (req, res, next) => {
    const user = req.user;
    var tour = new Tour({
      title: req.body.title,
      author: user._id,
      name : req.body.name,
      price : req.body.price,
      content: req.body.content,
      tags: req.body.tags.split(" ").map(e => e.trim()),
    });
    await tour.save();
    req.flash('success', 'Successfully posted');
    res.redirect('/tours');
  }));

  router.post('/:id/answers', needAuth, catchErrors(async (req, res, next) => {
    const user = req.user;
    const tour = await Tour.findById(req.params.id);

    if (!tour) {
      req.flash('danger', 'Not exist tour');
      return res.redirect('back');
    }

    var answer = new Answer({
      author: user._id,
      tour: tour._id,
      content: req.body.content
    });
    await answer.save();
    tour.numAnswers++;
    await tour.save();

    const url = `/tours/${tour._id}#${answer._id}`;
    io.to(tour.author.toString())
      .emit('answered', {url: url, tour: tour});
    console.log('SOCKET EMIT', tour.author.toString(), 'answered', {url: url, tour: tour})
    req.flash('success', 'Successfully answered');
    res.redirect(`/tours/${req.params.id}`);
  }));

  return router;
}