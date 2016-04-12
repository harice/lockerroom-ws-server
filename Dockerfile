FROM node:latest

## set some ENV vars
ENV HOME /root
ENV TERM dumb
ENV PROJECT_ROOT /opt/app

# install some apt packages (man)
RUN apt-get update \
  && rm -rf /var/lib/apt/lists/*

# install some global node modules
RUN npm install -g \
  nodemon@1.3.7

# use changes to dependency files to force Docker not to use the cache
# when we change our application's dependencies:
RUN mkdir -p /tmp/app

# add our dependency files to a /tmp location
ADD package.json /tmp/app/package.json

# install dependencies
RUN cd /tmp/app/ && npm install

# create app log folder
RUN mkdir -p /var/log/rp-websockets

# forward request and error logs to docker log collector
RUN ln -sf /dev/stdout /var/log/rp-websockets/rp-websockets.log

# add our app files
RUN mkdir -p $PROJECT_ROOT
ADD . $PROJECT_ROOT
WORKDIR $PROJECT_ROOT

## move our node_modules back into app
RUN cp -a /tmp/app/node_modules $PROJECT_ROOT

## expose app port
EXPOSE 3001

CMD ["bin/start.sh"]
