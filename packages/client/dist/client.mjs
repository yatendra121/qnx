class s {
  constructor(r = {}) {
    this.response = r;
  }
  getErrorCode() {
    return this.response.errorCode;
  }
  getErrors() {
    return this.response.errors;
  }
  getError() {
    return this.response.error;
  }
  getMessage() {
    return this.response.message;
  }
  getData() {
    return this.response.data;
  }
}
class t {
  constructor(r) {
    this.response = r;
  }
  getData() {
    return this.response.data;
  }
  getMessage() {
    return this.response.message;
  }
}
class o {
  constructor(r) {
    this.response = r;
  }
  getError() {
    return this.response.error;
  }
  getErrors() {
    return this.response.errors;
  }
  getErrorCode() {
    return this.response.errorCode;
  }
}
export {
  o as ApiErrorResponse,
  s as ApiResponse,
  t as ApiSuccessResponse
};
