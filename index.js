const { ApolloServer } = require('@apollo/server')
const { startStandaloneServer } = require('@apollo/server/standalone')
const { v1: uuid } = require('uuid');
const { GraphQLError } = require('graphql');

const mongoose = require('mongoose');
mongoose.set('strictQuery', false);
const Book = require('./models/book');
const Author = require('./models/author');
const User = require('./models/user');

const jwt = require('jsonwebtoken');

require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

console.log('connectig to', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('connected to MongoDB');
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message);
  });
  
  // mongoose.set('debug', true);

let authors = [
  {
    name: 'Robert Martin',
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952,
  },
  {
    name: 'Martin Fowler',
    id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
    born: 1963
  },
  {
    name: 'Fyodor Dostoevsky',
    id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
    born: 1821
  },
  { 
    name: 'Joshua Kerievsky', // birthyear not known
    id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  },
  { 
    name: 'Sandi Metz', // birthyear not known
    id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  },
]

/*
 * Suomi:
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
 *
 * English:
 * It might make more sense to associate a book with its author by storing the author's id in the context of the book instead of the author's name
 * However, for simplicity, we will store the author's name in connection with the book
 *
 * Spanish:
 * Podría tener más sentido asociar un libro con su autor almacenando la id del autor en el contexto del libro en lugar del nombre del autor
 * Sin embargo, por simplicidad, almacenaremos el nombre del autor en conección con el libro
*/

let books = [
  {
    title: 'Clean Code',
    published: 2008,
    author: 'Robert Martin',
    id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Agile software development',
    published: 2002,
    author: 'Robert Martin',
    id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
    genres: ['agile', 'patterns', 'design']
  },
  {
    title: 'Refactoring, edition 2',
    published: 2018,
    author: 'Martin Fowler',
    id: "afa5de00-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring']
  },
  {
    title: 'Refactoring to patterns',
    published: 2008,
    author: 'Joshua Kerievsky',
    id: "afa5de01-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'patterns']
  },  
  {
    title: 'Practical Object-Oriented Design, An Agile Primer Using Ruby',
    published: 2012,
    author: 'Sandi Metz',
    id: "afa5de02-344d-11e9-a414-719c6709cf3e",
    genres: ['refactoring', 'design']
  },
  {
    title: 'Crime and punishment',
    published: 1866,
    author: 'Fyodor Dostoevsky',
    id: "afa5de03-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'crime']
  },
  {
    title: 'The Demon ',
    published: 1872,
    author: 'Fyodor Dostoevsky',
    id: "afa5de04-344d-11e9-a414-719c6709cf3e",
    genres: ['classic', 'revolution']
  },
]

/*
  you can remove the placeholder query once your first one has been implemented 
*/

const typeDefs = `
  type Author {
    name: String!
    born: Int
    id: ID!
    bookCount: Int!
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    id: ID!
    genres: [String!]!
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  enum YesNo {
    YES
    NO
  }
  
  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book

    editAuthor(
      name: String!
      setBornTo: Int!
    ): Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User

    login(
      username: String!
      password: String!
    ): Token
  }
`

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      const books = await Book.find({}).populate('author');
      
      if (!args.author && !args.genre) {
        return books;
      }
      else if (args.author && args.genre) {
        const byGenre = books.filter(b => b.genres.includes(args.genre));
        return byGenre.filter(b => b.author === args.author);
      } else if (args.author) {
        return books.filter(b => b.author === args.author);
      } else {
        return books.filter(b => b.genres.includes(args.genre));
      }
    },
    allAuthors: async () => {
      return Author.find({});
    },
    me: (root, args, context) => {
      return context.currentUser;
    }
  },
  Author: {
    bookCount: async (root) => {
      const books = await Book.find({});
      return books.filter(b => b.author === root.name).length;
    }
  },
  Mutation: {
    addBook: async (root, args, context) => {
      const author = await Author.findOne({ name: args.author});
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'BAD_USER_INPUT',
          }
        })
      }

      if (!author) {
        const newAuthor = new Author({ name: args.author });
        await newAuthor.save();
        const book = new Book({ ...args, author: newAuthor });

        try {
          await book.save();
        } catch (error) {
          throw new GraphQLError('Saving book failed', {
            extensions: 'BAD_USER_INPUT',
            invalidArgs: args.title,
            error
          })
        }

        return book;
      }
      
      const book = new Book({ ...args, author: author });

      try {
        await book.save();
      } catch (error) {
        throw new GraphQLError('Saving book failed', {
          extensions: 'BAD_USER_INPUT',
          error
        })
      }

      return book;
    },
    editAuthor: async (root, args, context) => {
      const author = await Author.findOne({ name: args.name });
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError('not authenticated'), {
          extensions: {
            code: 'BAD_USER_INPUT',
          }
        }
      }
      
      if (!author) {
        return null;
      }
      
      author.born = args.setBornTo;

      try {
        author.save();
      } catch (error) {
        throw new GraphQLError('Changing born date failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.setBornTo,
            error
          }
        })
      }
      return author;
    },
    createUser: async (root, args) => {
      const user = new User({ username: args.username, favoriteGenre: args.favoriteGenre });
      
      try {
        user.save();
      } catch (error) {
        throw new GraphQLError('Creating the user failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.username,
            error
          }
        })
      }
      return user;
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });
      
      if ( !user || args.password !== 'secret') {
        throw new GraphQLError('wrong credentials', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        })
      }

      const userForToken = {
        username: user.username,
        id: user._id
      }

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET,
        { expiresIn: 60 * 60 }) }
    },
  },
}

// const resolvers = {
//   Query: {
//     bookCount: () => books.length,
//     authorCount: () => authors.length,
//     allBooks: (root, args) => {
//       if (!args.author && !args.genre) {
//         return books
//       }
//       else if (args.author && args.genre) {
//         const byGenre = books.filter(b => b.genres.includes(args.genre));
//         return byGenre.filter(b => b.author === args.author);
//       }
//       else if (args.author) {
//         return books.filter(b => b.author === args.author);
//       }
//       else {
//         return books.filter(b => b.genres.includes(args.genre));
//       }
      
//     },
//     allAuthors: () => authors
//   },
//   Author: {
//     bookCount: (root) => {
//       return books.filter(b => b.author === root.name).length;
//     }
//   },
//   Mutation: {
//     addBook: (root, args) => {
//       const book = { ...args, id: uuid() }
//       if (!authors.find(({ name }) => name === args.author)) {
//         authors = authors.concat({ name: args.author, id: uuid() });
//       }
//       books = books.concat(book);
//       return book;
//     },
//     editAuthor: (root, args) => {
//       const author = authors.find(a => a.name === args.name);
//       if (!author) {
//         return null;
//       }

//       const updatedAuthor = { ...author, born: args.setBornTo };
//       authors = authors.map(a => a.name === args.name ? updatedAuthor : a);
//       return updatedAuthor;
//     }
//   }
// }

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization: null;
    if (auth && auth.startsWith('Bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      )
      const currentUser = await User
        .findById(decodedToken.id);
      return { currentUser }
    }
  },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`)
})