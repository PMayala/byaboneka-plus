FROM node:20-alpine

WORKDIR /app

# Install dependencies for sharp and bcrypt
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
