var client=function(r){"use strict";class t{constructor(e={}){this.response=e}getErrorCode(){return this.response.errorCode}getErrors(){return this.response.errors}getError(){return this.response.error}getMessage(){return this.response.message}getData(){return this.response.data}}class o{constructor(e){this.response=e}getData(){return this.response.data}getMessage(){return this.response.message}}class n{constructor(e){this.response=e}getError(){return this.response.error}getErrors(){return this.response.errors}getErrorCode(){return this.response.errorCode}}return r.ApiErrorResponse=n,r.ApiResponse=t,r.ApiSuccessResponse=o,Object.defineProperty(r,Symbol.toStringTag,{value:"Module"}),r}({});
