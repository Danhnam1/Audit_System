/**
 * Converts technical error objects to user-friendly error messages in English
 * @param error - Error object from API calls or exceptions
 * @param defaultMessage - Default message to show if error cannot be parsed
 * @returns User-friendly error message
 */
export const getUserFriendlyErrorMessage = (error: any, defaultMessage: string = 'An error occurred. Please try again.'): string => {
  // Extract error message from various possible formats
  let errorMessage = '';
  
  if (error?.response?.data) {
    const data = error.response.data;
    
    // Handle validation errors object (ASP.NET Core ModelState format)
    if (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
      const validationErrors: string[] = [];
      Object.keys(data.errors).forEach(key => {
        const fieldErrors = data.errors[key];
        if (Array.isArray(fieldErrors)) {
          fieldErrors.forEach((err: string) => {
            validationErrors.push(`${key}: ${err}`);
          });
        } else if (typeof fieldErrors === 'string') {
          validationErrors.push(`${key}: ${fieldErrors}`);
        }
      });
      if (validationErrors.length > 0) {
        errorMessage = validationErrors.join(', ');
      }
    }
    
    // Extract message from various formats
    if (!errorMessage) {
      if (typeof data === 'string') {
        errorMessage = data;
      } else if (data?.message) {
        errorMessage = data.message;
      } else if (data?.Message) {
        errorMessage = data.Message;
      } else if (data?.error) {
        errorMessage = data.error;
      } else if (data?.Error) {
        errorMessage = data.Error;
      } else if (data?.reason) {
        errorMessage = data.reason;
      } else if (data?.Reason) {
        errorMessage = data.Reason;
      }
    }
  } else if (error?.response && typeof error.response === 'string') {
    errorMessage = error.response;
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Convert technical errors to user-friendly messages
  const statusCode = error?.response?.status;
  const errorMsgLower = errorMessage.toLowerCase();

  // HTTP Status Code based messages
  if (statusCode === 400) {
    // Check for specific 400 errors
    if (errorMsgLower.includes('bad request') || errorMsgLower.includes('invalid')) {
      return 'Invalid information. Please check your input and try again.';
    }
    if (errorMsgLower.includes('login') || errorMsgLower.includes('email') || errorMsgLower.includes('password')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    return 'Invalid request. Please check your input and try again.';
  }
  
  if (statusCode === 401) {
    // Check for login/credential errors (wrong password, invalid credentials, etc.)
    // These errors indicate a login attempt failure, not an expired session
    const isLoginError = 
      errorMsgLower.includes('login') || 
      errorMsgLower.includes('authentication') ||
      errorMsgLower.includes('password') ||
      errorMsgLower.includes('credentials') ||
      errorMsgLower.includes('invalid credentials') ||
      errorMsgLower.includes('incorrect password') ||
      errorMsgLower.includes('wrong password') ||
      errorMsgLower.includes('login failed') ||
      (errorMsgLower.includes('unauthorized') && (errorMsgLower.includes('user') || errorMsgLower.includes('email')));
    
    if (isLoginError) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    // Default for 401: session expired (e.g., expired token, missing token)
    return 'Your session has expired. Please log in again.';
  }
  
  if (statusCode === 403) {
    return 'You do not have permission to perform this action.';
  }
  
  if (statusCode === 404) {
    return 'The requested item was not found.';
  }
  
  if (statusCode === 409) {
    return 'A conflict occurred. The item may already exist.';
  }
  
  if (statusCode === 422) {
    return 'Validation failed. Please check your input and try again.';
  }
  
  if (statusCode === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  if (statusCode === 442) {
    return 'This item has expired. Please request a new one.';
  }
  
  if (statusCode === 500) {
    return 'A server error occurred. Please try again later or contact support.';
  }
  
  if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return 'The server is temporarily unavailable. Please try again later.';
  }

  // Network errors
  if (errorMsgLower.includes('network') || errorMsgLower.includes('timeout') || errorMsgLower.includes('connection')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // Login/Authentication specific errors
  if (errorMsgLower.includes('login failed') || errorMsgLower.includes('invalid credentials') || errorMsgLower.includes('incorrect password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (errorMsgLower.includes('account blocked') || errorMsgLower.includes('account locked')) {
    return 'Your account has been blocked. Please contact administrator for support.';
  }

  // Common API error patterns
  if (errorMsgLower.includes('not found')) {
    return 'The requested item was not found.';
  }

  if (errorMsgLower.includes('already exists') || errorMsgLower.includes('duplicate')) {
    return 'This item already exists. Please use a different value.';
  }

  if (errorMsgLower.includes('required') || errorMsgLower.includes('missing')) {
    return 'Please fill in all required fields.';
  }

  if (errorMsgLower.includes('expired')) {
    return 'This item has expired. Please request a new one.';
  }

  if (errorMsgLower.includes('invalid') && !errorMsgLower.includes('request')) {
    return 'Invalid information. Please check your input and try again.';
  }

  // If we have a meaningful error message that's already user-friendly, return it
  // Filter out technical error messages (but be careful not to filter user-friendly messages)
  const technicalPatterns = [
    'bad request',
    'internal server error',
    'unauthorized',
    'forbidden',
    'status code',
    'http error',
    'http status',
    'err_',
    'axioserror',
    'network error',
    'request failed with status code',
    'request failed',
  ];

  // Only filter if error message contains technical patterns AND looks like a technical error
  const isTechnicalError = technicalPatterns.some(pattern => errorMsgLower.includes(pattern)) &&
    (errorMsgLower.includes('status code') || errorMsgLower.includes('http') || errorMsgLower.match(/\d{3}/));
  
  if (errorMessage && !isTechnicalError && errorMessage.length < 200) {
    // If message seems user-friendly and not too long, return it
    return errorMessage;
  }

  // Fallback to default message
  return defaultMessage;
};
