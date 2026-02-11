import feathersMongoose from 'feathers-mongoose';
const { Service } = feathersMongoose;
import Invites from '../../models/invites.model.js';
import hooks from './invites.hooks.js';

export default function (app) {
  const options = { 
    Model: Invites, 
    paginate: app.get('paginate'),
    multi: ['create'] // Enable bulk create
  };
  app.use('/invites', new Service(options));
  const service = app.service('invites');
  service.hooks(hooks(app));
}

