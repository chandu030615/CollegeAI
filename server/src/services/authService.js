const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const {
  supabase,
  localDb,
  isSupabaseConfigured
} = require('../config/database');

const registerUser = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Name, email, and password are required.'
    };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // IMPORTANT:
  // Public registration can ONLY create Student accounts.
  // Any role supplied by the client is intentionally ignored.
  const role = 'student';

  if (isSupabaseConfigured()) {
    // Check existing email in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Email is already registered.'
      };
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name,
        email: normalizedEmail,
        password_hash,
        role
      })
      .select('id, name, email, role, created_at')
      .single();

    if (error) {
      throw {
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      };
    }

    const token = generateToken(newUser);

    return {
      user: newUser,
      token
    };
  } else {
    // Local In-Memory Fallback
    const existingUser = localDb.users.find(
      (u) => u.email === normalizedEmail
    );

    if (existingUser) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Email is already registered.'
      };
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = {
      id: uuidv4(),
      name,
      email: normalizedEmail,
      password_hash,
      role,
      created_at: new Date().toISOString()
    };

    localDb.users.push(newUser);

    const safeUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      created_at: newUser.created_at
    };

    const token = generateToken(safeUser);

    return {
      user: safeUser,
      token
    };
  }
};

const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Email and password are required.'
    };
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (isSupabaseConfigured()) {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (error || !user) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      };
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      };
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    return {
      user: safeUser,
      token
    };
  } else {
    const user = localDb.users.find(
      (u) => u.email === normalizedEmail
    );

    if (!user) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      };
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      };
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    return {
      user: safeUser,
      token
    };
  }
};

const getUserById = async (id) => {
  if (isSupabaseConfigured()) {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .eq('id', id)
      .single();

    if (!user) {
      throw {
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found.'
      };
    }

    return user;
  } else {
    const user = localDb.users.find(
      (u) => u.id === id
    );

    if (!user) {
      throw {
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found.'
      };
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };
  }
};

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    {
      expiresIn: '7d'
    }
  );
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  generateToken
};