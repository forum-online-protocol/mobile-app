#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(PassportReaderModule, RCTEventEmitter)

RCT_EXTERN_METHOD(startPassportScan:(NSString *)documentNumber
                  dateOfBirth:(NSString *)dateOfBirth
                  dateOfExpiry:(NSString *)dateOfExpiry
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startMRZScanner:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startIDCardScanner:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end