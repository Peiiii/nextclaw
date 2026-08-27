#include <node_api.h>
#include <ApplicationServices/ApplicationServices.h>
#include <AppKit/AppKit.h>
#include <ScreenCaptureKit/ScreenCaptureKit.h>
#include <Vision/Vision.h>
#include <map>
#include <string>
#include <utility>
#include <vector>


struct AccessibilityWatch {
  napi_env env;
  napi_ref callback;
  AXObserverRef observer;
  AXUIElementRef application;
  std::vector<AXUIElementRef> elements;
};

static std::map<std::string, AccessibilityWatch *> Watches;
static uint64_t NextWatchId = 1;
static constexpr float AccessibilityMessagingTimeoutSeconds = 0.5f;

static napi_value JsString(napi_env env, NSString *value);
static napi_value JsNumber(napi_env env, double value);
static void Set(napi_env env, napi_value object, const char *key, napi_value value);
static NSDictionary *FindFrontWindow(NSRunningApplication *application);

struct WindowCaptureRequest {
  napi_env env;
  napi_deferred deferred;
  napi_threadsafe_function completion;
  CGImageRef image;
  NSString *errorMessage;
  NSString *windowTitle;
  CGRect windowFrame;
  bool lowDetail;
  int pid;
  uint32_t windowId;
  bool includeTarget;
};

struct TargetWindowRequest {
  napi_env env;
  napi_deferred deferred;
  napi_threadsafe_function completion;
  NSString *bundleId;
  int expectedPid;
  NSString *errorMessage;
  SCWindow *window;
};

static void CompleteWindowCapture(WindowCaptureRequest *request) {
  napi_call_threadsafe_function(request->completion, request, napi_tsfn_nonblocking);
}

static void ResolveWindowCapture(napi_env env, napi_value, void *, void *data) {
  WindowCaptureRequest *request = (WindowCaptureRequest *)data;
  if (!env) {
    if (request->image) CGImageRelease(request->image);
    if (request->errorMessage) [request->errorMessage release];
    if (request->windowTitle) [request->windowTitle release];
    delete request;
    return;
  }
  if (request->errorMessage) {
    napi_value message;
    napi_create_string_utf8(env, request->errorMessage.UTF8String, NAPI_AUTO_LENGTH, &message);
    napi_value error;
    napi_create_error(env, nullptr, message, &error);
    napi_reject_deferred(env, request->deferred, error);
  } else {
    NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:request->image];
    NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    napi_value result;
    napi_create_object(env, &result);
    Set(env, result, "mimeType", JsString(env, @"image/png"));
    Set(env, result, "data", JsString(env, [png base64EncodedStringWithOptions:0]));
    Set(env, result, "width", JsNumber(env, CGImageGetWidth(request->image)));
    Set(env, result, "height", JsNumber(env, CGImageGetHeight(request->image)));
    if (request->includeTarget) {
      Set(env, result, "pid", JsNumber(env, request->pid));
      Set(env, result, "windowId", JsNumber(env, request->windowId));
    }
    if (!CGRectIsEmpty(request->windowFrame)) {
      napi_value window;
      napi_create_object(env, &window);
      if (request->windowTitle) Set(env, window, "title", JsString(env, request->windowTitle));
      napi_value position;
      napi_create_object(env, &position);
      Set(env, position, "x", JsNumber(env, request->windowFrame.origin.x));
      Set(env, position, "y", JsNumber(env, request->windowFrame.origin.y));
      Set(env, window, "position", position);
      napi_value size;
      napi_create_object(env, &size);
      Set(env, size, "width", JsNumber(env, request->windowFrame.size.width));
      Set(env, size, "height", JsNumber(env, request->windowFrame.size.height));
      Set(env, window, "size", size);
      Set(env, result, "window", window);
    }
    napi_resolve_deferred(env, request->deferred, result);
    [bitmap release];
  }
  if (request->image) CGImageRelease(request->image);
  if (request->errorMessage) [request->errorMessage release];
  if (request->windowTitle) [request->windowTitle release];
  napi_release_threadsafe_function(request->completion, napi_tsfn_release);
  delete request;
}

static void CompleteTargetWindow(TargetWindowRequest *request) {
  napi_call_threadsafe_function(request->completion, request, napi_tsfn_nonblocking);
}

static void ResolveTargetWindow(napi_env env, napi_value, void *, void *data) {
  TargetWindowRequest *request = (TargetWindowRequest *)data;
  if (!env) {
    if (request->bundleId) [request->bundleId release];
    if (request->errorMessage) [request->errorMessage release];
    if (request->window) [request->window release];
    delete request;
    return;
  }
  if (request->errorMessage || !request->window) {
    napi_value message;
    napi_create_string_utf8(env, (request->errorMessage ?: @"No capturable target window was found.").UTF8String, NAPI_AUTO_LENGTH, &message);
    napi_value error;
    napi_create_error(env, nullptr, message, &error);
    napi_reject_deferred(env, request->deferred, error);
  } else {
    napi_value result;
    napi_create_object(env, &result);
    Set(env, result, "pid", JsNumber(env, request->window.owningApplication.processID));
    Set(env, result, "windowId", JsNumber(env, request->window.windowID));
    napi_value window;
    napi_create_object(env, &window);
    if (request->window.title) Set(env, window, "title", JsString(env, request->window.title));
    napi_value position;
    napi_create_object(env, &position);
    Set(env, position, "x", JsNumber(env, request->window.frame.origin.x));
    Set(env, position, "y", JsNumber(env, request->window.frame.origin.y));
    Set(env, window, "position", position);
    napi_value size;
    napi_create_object(env, &size);
    Set(env, size, "width", JsNumber(env, request->window.frame.size.width));
    Set(env, size, "height", JsNumber(env, request->window.frame.size.height));
    Set(env, window, "size", size);
    Set(env, result, "window", window);
    napi_resolve_deferred(env, request->deferred, result);
  }
  if (request->bundleId) [request->bundleId release];
  if (request->errorMessage) [request->errorMessage release];
  if (request->window) [request->window release];
  napi_release_threadsafe_function(request->completion, napi_tsfn_release);
  delete request;
}

static void ReleaseWatch(AccessibilityWatch *watch) {
  if (!watch) return;
  CFRunLoopSourceRef source = AXObserverGetRunLoopSource(watch->observer);
  if (source) CFRunLoopRemoveSource(CFRunLoopGetMain(), source, kCFRunLoopDefaultMode);
  for (AXUIElementRef element : watch->elements) CFRelease(element);
  if (watch->application) CFRelease(watch->application);
  if (watch->observer) CFRelease(watch->observer);
  if (watch->callback) napi_delete_reference(watch->env, watch->callback);
  delete watch;
}

static void CleanupWatches(void *) {
  for (auto &entry : Watches) ReleaseWatch(entry.second);
  Watches.clear();
}

static napi_value JsString(napi_env env, NSString *value) {
  napi_value result;
  napi_create_string_utf8(env, value.UTF8String ?: "", NAPI_AUTO_LENGTH, &result);
  return result;
}

static napi_value JsBoolean(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

static napi_value JsNumber(napi_env env, double value) {
  napi_value result;
  napi_create_double(env, value, &result);
  return result;
}

static void Set(napi_env env, napi_value object, const char *key, napi_value value) {
  napi_set_named_property(env, object, key, value);
}

static NSString *ReadString(napi_env env, napi_value value) {
  size_t size = 0;
  napi_get_value_string_utf8(env, value, nullptr, 0, &size);
  std::vector<char> buffer(size + 1);
  napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &size);
  return [NSString stringWithUTF8String:buffer.data()];
}

static bool ReadLowDetailOption(napi_env env, napi_value value) {
  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok) return false;
  if (type == napi_string) return [ReadString(env, value) isEqualToString:@"low"];
  if (type != napi_object) return false;
  napi_value detail;
  if (napi_get_named_property(env, value, "detail", &detail) != napi_ok) return false;
  napi_valuetype detailType;
  return napi_typeof(env, detail, &detailType) == napi_ok &&
    detailType == napi_string &&
    [ReadString(env, detail) isEqualToString:@"low"];
}

static napi_value Throw(napi_env env, const char *code, NSString *message) {
  napi_value error;
  napi_value text;
  napi_value codeValue;
  napi_create_string_utf8(env, message.UTF8String ?: "Desktop accessibility operation failed.", NAPI_AUTO_LENGTH, &text);
  napi_create_error(env, nullptr, text, &error);
  napi_create_string_utf8(env, code, NAPI_AUTO_LENGTH, &codeValue);
  napi_set_named_property(env, error, "code", codeValue);
  napi_throw(env, error);
  return nullptr;
}

static int ReadProcessIdentifierOption(napi_env env, napi_value value) {
  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_object) return 0;
  napi_value pidValue;
  if (napi_get_named_property(env, value, "pid", &pidValue) != napi_ok) return 0;
  int32_t pid = 0;
  if (napi_get_value_int32(env, pidValue, &pid) != napi_ok || pid <= 0) return 0;
  return pid;
}

static int ReadWindowIdentifierOption(napi_env env, napi_value value) {
  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_object) return 0;
  napi_value windowIdValue;
  if (napi_get_named_property(env, value, "windowId", &windowIdValue) != napi_ok) return 0;
  int32_t windowId = 0;
  if (napi_get_value_int32(env, windowIdValue, &windowId) != napi_ok || windowId <= 0) return 0;
  return windowId;
}

static NSRunningApplication *ResolveRunningApplication(NSString *bundleId, int expectedPid = 0) {
  if (expectedPid > 0) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationWithProcessIdentifier:expectedPid];
    if (application && [application.bundleIdentifier isEqualToString:bundleId]) return application;
    return nil;
  }
  NSRunningApplication *frontmost = NSWorkspace.sharedWorkspace.frontmostApplication;
  if ([frontmost.bundleIdentifier isEqualToString:bundleId]) return frontmost;
  NSArray<NSRunningApplication *> *applications = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleId];
  NSRunningApplication *bestApplication = nil;
  NSTimeInterval newestLaunchTime = 0;
  for (NSRunningApplication *application in applications) {
    NSDictionary *window = FindFrontWindow(application);
    if (!window) continue;
    const NSTimeInterval launchTime = application.launchDate.timeIntervalSince1970;
    if (bestApplication && launchTime <= newestLaunchTime) continue;
    newestLaunchTime = launchTime;
    bestApplication = application;
  }
  return bestApplication ?: applications.firstObject;
}

static void ActivateApplication(NSRunningApplication *application) {
  [application activateWithOptions:NSApplicationActivateAllWindows];
}

static void FocusWindow(NSRunningApplication *application, int expectedWindowId) {
  ActivateApplication(application);
  if (expectedWindowId <= 0) return;
  AXUIElementRef appElement = AXUIElementCreateApplication(application.processIdentifier);
  if (!appElement) return;
  CFTypeRef rawWindows = nullptr;
  if (
    AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute, &rawWindows) == kAXErrorSuccess &&
    rawWindows && CFGetTypeID(rawWindows) == CFArrayGetTypeID()
  ) {
    CFArrayRef windows = (CFArrayRef)rawWindows;
    for (CFIndex index = 0; index < CFArrayGetCount(windows); index++) {
      AXUIElementRef candidate = (AXUIElementRef)CFArrayGetValueAtIndex(windows, index);
      CFTypeRef number = nullptr;
      int windowId = 0;
      if (
        AXUIElementCopyAttributeValue(candidate, CFSTR("AXWindowNumber"), &number) == kAXErrorSuccess &&
        number && CFGetTypeID(number) == CFNumberGetTypeID()
      ) {
        CFNumberGetValue((CFNumberRef)number, kCFNumberIntType, &windowId);
      }
      if (number) CFRelease(number);
      if (windowId != expectedWindowId) continue;
      AXUIElementPerformAction(candidate, kAXRaiseAction);
      AXUIElementSetAttributeValue(appElement, kAXFocusedWindowAttribute, candidate);
      AXUIElementSetAttributeValue(appElement, kAXMainWindowAttribute, candidate);
      break;
    }
  }
  if (rawWindows) CFRelease(rawWindows);
  CFRelease(appElement);
  // AX focus attributes are not consistently settable for document windows.
  // A click in the exact captured window's title bar is the platform fallback:
  // it focuses that window without choosing a document coordinate or control.
  CFArrayRef rawWindowInfo = CGWindowListCopyWindowInfo(
    kCGWindowListOptionIncludingWindow,
    (CGWindowID)expectedWindowId
  );
  if (rawWindowInfo) {
    NSArray *windowInfo = CFBridgingRelease(rawWindowInfo);
    NSDictionary *window = windowInfo.firstObject;
    NSDictionary *bounds = window[(id)kCGWindowBounds];
    const double x = [(NSNumber *)bounds[@"X"] doubleValue];
    const double y = [(NSNumber *)bounds[@"Y"] doubleValue];
    const double width = [(NSNumber *)bounds[@"Width"] doubleValue];
    const double height = [(NSNumber *)bounds[@"Height"] doubleValue];
    if (width >= 100 && height >= 100) {
      const CGPoint titlePoint = CGPointMake(x + width / 2, y + MIN(12, height / 2));
      CGEventRef down = CGEventCreateMouseEvent(nullptr, kCGEventLeftMouseDown, titlePoint, kCGMouseButtonLeft);
      CGEventRef up = CGEventCreateMouseEvent(nullptr, kCGEventLeftMouseUp, titlePoint, kCGMouseButtonLeft);
      if (down && up) {
        CGEventPost(kCGHIDEventTap, down);
        CGEventPost(kCGHIDEventTap, up);
      }
      if (down) CFRelease(down);
      if (up) CFRelease(up);
    }
  }
  [NSThread sleepForTimeInterval:0.1];
}

static NSString *CopyStringAttribute(AXUIElementRef element, CFStringRef attribute) {
  CFTypeRef value = nullptr;
  if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess || !value) return nil;
  NSString *result = nil;
  if (CFGetTypeID(value) == CFStringGetTypeID()) {
    result = [(__bridge NSString *)value copy];
  } else if (CFGetTypeID(value) == CFNumberGetTypeID()) {
    result = [(__bridge NSNumber *)value stringValue];
  }
  CFRelease(value);
  return result;
}

static bool IsDialogWindow(AXUIElementRef element) {
  NSString *role = CopyStringAttribute(element, kAXRoleAttribute);
  NSString *subrole = CopyStringAttribute(element, kAXSubroleAttribute);
  CFTypeRef modalValue = nullptr;
  const bool isModal =
    AXUIElementCopyAttributeValue(element, kAXModalAttribute, &modalValue) == kAXErrorSuccess &&
    modalValue && CFGetTypeID(modalValue) == CFBooleanGetTypeID() && CFBooleanGetValue((CFBooleanRef)modalValue);
  if (modalValue) CFRelease(modalValue);
  CFTypeRef defaultButton = nullptr;
  const bool hasDefaultButton =
    AXUIElementCopyAttributeValue(element, kAXDefaultButtonAttribute, &defaultButton) == kAXErrorSuccess &&
    defaultButton && CFGetTypeID(defaultButton) == AXUIElementGetTypeID();
  if (defaultButton) CFRelease(defaultButton);
  CFTypeRef cancelButton = nullptr;
  const bool hasCancelButton =
    AXUIElementCopyAttributeValue(element, kAXCancelButtonAttribute, &cancelButton) == kAXErrorSuccess &&
    cancelButton && CFGetTypeID(cancelButton) == AXUIElementGetTypeID();
  if (cancelButton) CFRelease(cancelButton);
  // NSOpenPanel commonly reports AXWindow/AXStandardWindow instead of AXDialog.
  // Its default/cancel buttons are the reliable AX distinction from a document
  // window, so exclude it from an application's normal target window.
  const bool isDialog = [role isEqualToString:@"AXDialog"] ||
    [subrole isEqualToString:(NSString *)kAXDialogSubrole] || isModal ||
    (hasDefaultButton && hasCancelButton);
  if (role) [role release];
  if (subrole) [subrole release];
  return isDialog;
}

static void AddStringAttribute(
  napi_env env,
  napi_value output,
  AXUIElementRef element,
  CFStringRef attribute,
  const char *key
) {
  NSString *value = CopyStringAttribute(element, attribute);
  if (value) Set(env, output, key, JsString(env, value));
}

static CFMutableArrayRef CopyTraversalChildren(AXUIElementRef element) {
  CFMutableArrayRef result = CFArrayCreateMutable(
    kCFAllocatorDefault,
    0,
    &kCFTypeArrayCallBacks
  );
  CFMutableSetRef seen = CFSetCreateMutable(
    kCFAllocatorDefault,
    0,
    &kCFTypeSetCallBacks
  );
  const CFStringRef attributes[] = {
    kAXChildrenAttribute,
    kAXWindowsAttribute,
  };
  for (CFStringRef attribute : attributes) {
    CFTypeRef rawValues = nullptr;
    if (
      AXUIElementCopyAttributeValue(element, attribute, &rawValues) != kAXErrorSuccess ||
      !rawValues ||
      CFGetTypeID(rawValues) != CFArrayGetTypeID()
    ) {
      if (rawValues) CFRelease(rawValues);
      continue;
    }
    CFArrayRef values = (CFArrayRef)rawValues;
    for (CFIndex index = 0; index < CFArrayGetCount(values); index++) {
      CFTypeRef value = CFArrayGetValueAtIndex(values, index);
      if (CFSetContainsValue(seen, value)) continue;
      CFSetAddValue(seen, value);
      CFArrayAppendValue(result, value);
    }
    CFRelease(rawValues);
  }
  CFRelease(seen);
  return result;
}

static napi_value SnapshotElement(
  napi_env env,
  AXUIElementRef element,
  int depth,
  int maxDepth,
  int maxNodes,
  int *count,
  CFMutableSetRef visited
) {
  CFSetAddValue(visited, element);
  napi_value output;
  napi_create_object(env, &output);
  (*count)++;
  AddStringAttribute(env, output, element, kAXRoleAttribute, "role");
  AddStringAttribute(env, output, element, kAXSubroleAttribute, "subrole");
  AddStringAttribute(env, output, element, kAXTitleAttribute, "title");
  AddStringAttribute(env, output, element, kAXValueAttribute, "value");
  AddStringAttribute(env, output, element, kAXDescriptionAttribute, "description");
  AddStringAttribute(env, output, element, kAXIdentifierAttribute, "identifier");

  const std::vector<std::pair<CFStringRef, const char *>> booleanAttributes = {
    { kAXEnabledAttribute, "enabled" },
    { kAXFocusedAttribute, "focused" },
  };
  for (const auto &entry : booleanAttributes) {
    CFTypeRef value = nullptr;
    if (AXUIElementCopyAttributeValue(element, entry.first, &value) == kAXErrorSuccess && value) {
      if (CFGetTypeID(value) == CFBooleanGetTypeID()) {
        Set(env, output, entry.second, JsBoolean(env, CFBooleanGetValue((CFBooleanRef)value)));
      }
      CFRelease(value);
    }
  }

  CFTypeRef rawPosition = nullptr;
  if (AXUIElementCopyAttributeValue(element, kAXPositionAttribute, &rawPosition) == kAXErrorSuccess &&
      rawPosition && CFGetTypeID(rawPosition) == AXValueGetTypeID()) {
    CGPoint point;
    if (AXValueGetValue((AXValueRef)rawPosition, (AXValueType)kAXValueCGPointType, &point)) {
      napi_value position;
      napi_create_object(env, &position);
      Set(env, position, "x", JsNumber(env, point.x));
      Set(env, position, "y", JsNumber(env, point.y));
      Set(env, output, "position", position);
    }
    CFRelease(rawPosition);
  }

  CFTypeRef rawSize = nullptr;
  if (AXUIElementCopyAttributeValue(element, kAXSizeAttribute, &rawSize) == kAXErrorSuccess &&
      rawSize && CFGetTypeID(rawSize) == AXValueGetTypeID()) {
    CGSize size;
    if (AXValueGetValue((AXValueRef)rawSize, (AXValueType)kAXValueCGSizeType, &size)) {
      napi_value dimensions;
      napi_create_object(env, &dimensions);
      Set(env, dimensions, "width", JsNumber(env, size.width));
      Set(env, dimensions, "height", JsNumber(env, size.height));
      Set(env, output, "size", dimensions);
    }
    CFRelease(rawSize);
  }

  if (depth >= maxDepth || *count >= maxNodes) return output;
  CFArrayRef children = CopyTraversalChildren(element);
  napi_value list;
  napi_create_array(env, &list);
  uint32_t outputIndex = 0;
  for (CFIndex index = 0; index < CFArrayGetCount(children) && *count < maxNodes; index++) {
    AXUIElementRef child = (AXUIElementRef)CFArrayGetValueAtIndex(children, index);
    if (CFSetContainsValue(visited, child)) continue;
    napi_set_element(
      env,
      list,
      outputIndex++,
      SnapshotElement(env, child, depth + 1, maxDepth, maxNodes, count, visited)
    );
  }
  if (outputIndex > 0) Set(env, output, "children", list);
  CFRelease(children);
  return output;
}

static int ReadIntegerOption(napi_env env, napi_value object, const char *name, int fallback) {
  bool hasProperty = false;
  napi_has_named_property(env, object, name, &hasProperty);
  if (!hasProperty) return fallback;
  napi_value value;
  int32_t number = fallback;
  napi_get_named_property(env, object, name, &value);
  napi_get_value_int32(env, value, &number);
  return number;
}

static napi_value IsTrusted(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  bool prompt = false;
  if (argc > 0) napi_get_value_bool(env, args[0], &prompt);
  NSDictionary *options = @{ (__bridge NSString *)kAXTrustedCheckOptionPrompt: @(prompt) };
  return JsBoolean(env, AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options));
}

static napi_value IsScreenCaptureTrusted(napi_env env, napi_callback_info info) {
  return JsBoolean(env, CGPreflightScreenCaptureAccess());
}

static napi_value RequestScreenCapturePermission(napi_env env, napi_callback_info info) {
  return JsBoolean(env, CGRequestScreenCaptureAccess());
}

static napi_value RecognizeText(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"PNG data is required.");
  if (@available(macOS 10.15, *)) {
    NSString *base64 = ReadString(env, args[0]);
    const bool lowDetail = argc > 1 && ReadLowDetailOption(env, args[1]);
    NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 options:0];
    NSBitmapImageRep *image = [[NSBitmapImageRep alloc] initWithData:data];
    if (!image.CGImage) {
      return Throw(env, "image_decode_failed", @"The captured window image could not be decoded.");
    }
    VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
    request.recognitionLevel = lowDetail ? VNRequestTextRecognitionLevelFast : VNRequestTextRecognitionLevelAccurate;
    request.recognitionLanguages = @[ @"zh-Hans", @"en-US" ];
    request.usesLanguageCorrection = !lowDetail;
    VNImageRequestHandler *handler = [[VNImageRequestHandler alloc]
      initWithCGImage:image.CGImage
      options:@{}
    ];
    NSError *error = nil;
    if (![handler performRequests:@[ request ] error:&error]) {
      return Throw(env, "ocr_failed", error.localizedDescription ?: @"Text recognition failed.");
    }
    NSMutableArray<NSString *> *lines = [NSMutableArray array];
    for (VNRecognizedTextObservation *observation in request.results) {
      VNRecognizedText *candidate = [observation topCandidates:1].firstObject;
      if (candidate.string.length > 0) [lines addObject:candidate.string];
    }
    NSString *text = [lines componentsJoinedByString:@"\n"];
    if (text.length > 12000) text = [text substringToIndex:12000];
    return JsString(env, text);
  }
  return Throw(env, "operation_not_supported", @"On-device text recognition requires macOS 10.15 or later.");
}

static NSDictionary *FindAccessibilityWindow(NSRunningApplication *application) {
  AXUIElementRef appElement = AXUIElementCreateApplication(application.processIdentifier);
  if (!appElement) return nil;
  AXUIElementRef windowElement = nullptr;
  CFTypeRef main = nullptr;
  if (
    AXUIElementCopyAttributeValue(appElement, kAXMainWindowAttribute, &main) == kAXErrorSuccess &&
    main && CFGetTypeID(main) == AXUIElementGetTypeID()
  ) {
    windowElement = (AXUIElementRef)CFRetain(main);
  }
  if (main) CFRelease(main);
  if (windowElement && IsDialogWindow(windowElement)) {
    CFRelease(windowElement);
    windowElement = nullptr;
  }
  CFTypeRef focused = nullptr;
  if (
    !windowElement &&
    AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute, &focused) == kAXErrorSuccess &&
    focused && CFGetTypeID(focused) == AXUIElementGetTypeID()
  ) {
    windowElement = (AXUIElementRef)CFRetain(focused);
  }
  if (focused) CFRelease(focused);
  if (windowElement && IsDialogWindow(windowElement)) {
    CFRelease(windowElement);
    windowElement = nullptr;
  }
  if (!windowElement) {
    CFTypeRef windows = nullptr;
    if (
      AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute, &windows) == kAXErrorSuccess &&
      windows && CFGetTypeID(windows) == CFArrayGetTypeID() && CFArrayGetCount((CFArrayRef)windows) > 0
    ) {
      CFArrayRef candidates = (CFArrayRef)windows;
      for (CFIndex index = 0; index < CFArrayGetCount(candidates) && !windowElement; index++) {
        AXUIElementRef candidate = (AXUIElementRef)CFArrayGetValueAtIndex(candidates, index);
        if (!IsDialogWindow(candidate)) windowElement = (AXUIElementRef)CFRetain(candidate);
      }
    }
    if (windows) CFRelease(windows);
  }
  CFRelease(appElement);
  if (!windowElement) return nil;

  CFTypeRef windowNumber = nullptr;
  const AXError windowNumberStatus = AXUIElementCopyAttributeValue(
    windowElement,
    CFSTR("AXWindowNumber"),
    &windowNumber
  );
  int windowId = 0;
  if (
    windowNumberStatus == kAXErrorSuccess && windowNumber &&
    CFGetTypeID(windowNumber) == CFNumberGetTypeID()
  ) {
    CFNumberGetValue((CFNumberRef)windowNumber, kCFNumberIntType, &windowId);
  }
  if (windowNumber) CFRelease(windowNumber);
  if (windowId <= 0) {
    CFRelease(windowElement);
    return nil;
  }

  CGPoint position = CGPointZero;
  CGSize size = CGSizeZero;
  CFTypeRef rawPosition = nullptr;
  if (AXUIElementCopyAttributeValue(windowElement, kAXPositionAttribute, &rawPosition) == kAXErrorSuccess && rawPosition) {
    if (CFGetTypeID(rawPosition) == AXValueGetTypeID()) {
      AXValueGetValue((AXValueRef)rawPosition, (AXValueType)kAXValueCGPointType, &position);
    }
    CFRelease(rawPosition);
  }
  CFTypeRef rawSize = nullptr;
  if (AXUIElementCopyAttributeValue(windowElement, kAXSizeAttribute, &rawSize) == kAXErrorSuccess && rawSize) {
    if (CFGetTypeID(rawSize) == AXValueGetTypeID()) {
      AXValueGetValue((AXValueRef)rawSize, (AXValueType)kAXValueCGSizeType, &size);
    }
    CFRelease(rawSize);
  }
  NSString *title = CopyStringAttribute(windowElement, kAXTitleAttribute);
  CFRelease(windowElement);
  // Chrome can expose its tab-strip auxiliary AX window as the focused window.
  // It has a valid AXWindowNumber but is not the application content window.
  if (size.width < 100 || size.height < 100) {
    [title release];
    return nil;
  }
  NSDictionary *result = @{
    (id)kCGWindowNumber: @(windowId),
    (id)kCGWindowBounds: @{ @"X": @(position.x), @"Y": @(position.y), @"Width": @(size.width), @"Height": @(size.height) },
    (id)kCGWindowName: title ?: @"",
  };
  [title release];
  return result;
}

static NSDictionary *FindFrontWindow(NSRunningApplication *application) {
  NSDictionary *accessibilityWindow = FindAccessibilityWindow(application);
  if (accessibilityWindow) return accessibilityWindow;
  CFArrayRef rawWindows = CGWindowListCopyWindowInfo(
    // A normal application window can be fully occluded by the calling app.
    // `OnScreenOnly` omits it even though ScreenCaptureKit can capture its ID.
    // ScreenCaptureKit remains the authority for capturability below.
    kCGWindowListOptionAll | kCGWindowListExcludeDesktopElements,
    kCGNullWindowID
  );
  if (!rawWindows) return nil;
  NSArray *windows = CFBridgingRelease(rawWindows);
  NSDictionary *bestWindow = nil;
  double bestArea = 0;
  for (NSDictionary *window in windows) {
    NSNumber *ownerPid = window[(id)kCGWindowOwnerPID];
    NSNumber *layer = window[(id)kCGWindowLayer];
    NSDictionary *bounds = window[(id)kCGWindowBounds];
    const double width = [(NSNumber *)bounds[@"Width"] doubleValue];
    const double height = [(NSNumber *)bounds[@"Height"] doubleValue];
    if (
      ownerPid.integerValue != application.processIdentifier ||
      layer.integerValue != 0 ||
      width < 100 ||
      height < 100
    ) continue;
    const double area = width * height;
    if (area <= bestArea) continue;
    bestArea = area;
    bestWindow = window;
  }
  return bestWindow;
}

static napi_value ResolveWindow(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"bundleId is required.");
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = argc > 1 ? ReadProcessIdentifierOption(env, args[1]) : 0;
  NSRunningApplication *application = ResolveRunningApplication(bundleId, expectedPid);
  if (!application) return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  NSDictionary *window = FindFrontWindow(application);
  if (!window) return Throw(env, "window_not_found", @"No visible target application window was found.");
  napi_value result;
  napi_create_object(env, &result);
  Set(env, result, "pid", JsNumber(env, application.processIdentifier));
  Set(env, result, "windowId", JsNumber(env, [window[(id)kCGWindowNumber] unsignedIntValue]));
  napi_value windowResult;
  napi_create_object(env, &windowResult);
  NSString *title = window[(id)kCGWindowName];
  if (title) Set(env, windowResult, "title", JsString(env, title));
  NSDictionary *bounds = window[(id)kCGWindowBounds];
  napi_value position;
  napi_create_object(env, &position);
  Set(env, position, "x", JsNumber(env, [(NSNumber *)bounds[@"X"] doubleValue]));
  Set(env, position, "y", JsNumber(env, [(NSNumber *)bounds[@"Y"] doubleValue]));
  Set(env, windowResult, "position", position);
  napi_value size;
  napi_create_object(env, &size);
  Set(env, size, "width", JsNumber(env, [(NSNumber *)bounds[@"Width"] doubleValue]));
  Set(env, size, "height", JsNumber(env, [(NSNumber *)bounds[@"Height"] doubleValue]));
  Set(env, windowResult, "size", size);
  Set(env, result, "window", windowResult);
  return result;
}

static napi_value ResolveCaptureWindow(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"bundleId is required.");
  if (@available(macOS 14.0, *)) {
    // ScreenCaptureKit target selection continues below.
  } else {
    return Throw(env, "operation_not_supported", @"Native macOS window capture requires macOS 14 or later.");
  }
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = argc > 1 ? ReadProcessIdentifierOption(env, args[1]) : 0;
  TargetWindowRequest *request = new TargetWindowRequest{env, nullptr, nullptr, [bundleId copy], expectedPid, nullptr, nil};
  napi_value promise;
  napi_create_promise(env, &request->deferred, &promise);
  napi_value resourceName;
  napi_create_string_utf8(env, "nextclaw-window-target", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_threadsafe_function(
    env, nullptr, nullptr, resourceName, 0, 1, nullptr, nullptr, nullptr,
    ResolveTargetWindow, &request->completion
  );
  [SCShareableContent getShareableContentExcludingDesktopWindows:YES onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *content, NSError *error) {
    if (error) {
      request->errorMessage = [@"No capturable target window was found." retain];
      CompleteTargetWindow(request);
      return;
    }
    const pid_t frontmostPid = NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
    SCWindow *bestWindow = nil;
    double bestScore = -1;
    for (SCWindow *window in content.windows) {
      SCRunningApplication *owner = window.owningApplication;
      if (!owner || ![owner.bundleIdentifier isEqualToString:request->bundleId]) continue;
      if (request->expectedPid > 0 && owner.processID != request->expectedPid) continue;
      const double width = window.frame.size.width;
      const double height = window.frame.size.height;
      if (width < 100 || height < 100) continue;
      const double score = width * height + (owner.processID == frontmostPid ? 1000000000000.0 : 0);
      if (score <= bestScore) continue;
      bestScore = score;
      bestWindow = window;
    }
    if (!bestWindow) {
      request->errorMessage = [@"No capturable target window was found." retain];
    } else {
      request->window = [bestWindow retain];
    }
    CompleteTargetWindow(request);
  }];
  return promise;
}

static SCDisplay *FindDisplayForWindow(SCShareableContent *content, SCWindow *window) {
  const CGPoint center = CGPointMake(
    CGRectGetMidX(window.frame),
    CGRectGetMidY(window.frame)
  );
  for (SCDisplay *display in content.displays) {
    if (CGRectContainsPoint(display.frame, center)) return display;
  }
  return content.displays.firstObject;
}

static void CaptureWindowFromDisplay(
  WindowCaptureRequest *request,
  SCWindow *targetWindow,
  SCShareableContent *content
) {
  SCDisplay *display = FindDisplayForWindow(content, targetWindow);
  if (!display || display.frame.size.width <= 0 || display.frame.size.height <= 0) {
    request->errorMessage = [@"The target window is not on a shareable display." retain];
    CompleteWindowCapture(request);
    return;
  }
  SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:display excludingWindows:@[]];
  SCStreamConfiguration *configuration = [[SCStreamConfiguration alloc] init];
  const CGFloat longestSide = MAX(targetWindow.frame.size.width, targetWindow.frame.size.height);
  const CGFloat scale = request->lowDetail && longestSide > 960 ? 960 / longestSide : 1;
  configuration.width = MAX(1, (NSInteger)ceil(display.frame.size.width * scale));
  configuration.height = MAX(1, (NSInteger)ceil(display.frame.size.height * scale));
  const CGRect displayFrame = display.frame;
  const CGRect targetFrame = targetWindow.frame;
  [SCScreenshotManager captureImageWithFilter:filter configuration:configuration completionHandler:^(CGImageRef image, NSError *captureError) {
    if (captureError || !image) {
      request->errorMessage = [[NSString stringWithFormat:@"Display capture failed: %@", captureError.localizedDescription ?: @"unknown error"] retain];
      CompleteWindowCapture(request);
      return;
    }
    const CGFloat scaleX = CGImageGetWidth(image) / displayFrame.size.width;
    const CGFloat scaleY = CGImageGetHeight(image) / displayFrame.size.height;
    CGRect crop = CGRectMake(
      (targetFrame.origin.x - displayFrame.origin.x) * scaleX,
      (targetFrame.origin.y - displayFrame.origin.y) * scaleY,
      targetFrame.size.width * scaleX,
      targetFrame.size.height * scaleY
    );
    crop = CGRectIntersection(crop, CGRectMake(0, 0, CGImageGetWidth(image), CGImageGetHeight(image)));
    CGImageRef cropped = CGRectIsEmpty(crop) ? nullptr : CGImageCreateWithImageInRect(image, crop);
    if (!cropped) {
      request->errorMessage = [@"The target window did not fit inside the captured display frame." retain];
    } else {
      request->image = cropped;
    }
    CompleteWindowCapture(request);
  }];
  [configuration release];
  [filter release];
}

static void CaptureShareableWindow(
  WindowCaptureRequest *request,
  SCWindow *targetWindow,
  SCShareableContent *content
) {
  request->pid = targetWindow.owningApplication.processID;
  request->windowId = targetWindow.windowID;
  request->windowFrame = targetWindow.frame;
  request->windowTitle = [targetWindow.title copy];
  SCContentFilter *filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow:targetWindow];
  SCStreamConfiguration *configuration = [[SCStreamConfiguration alloc] init];
  const CGFloat longestSide = MAX(targetWindow.frame.size.width, targetWindow.frame.size.height);
  const CGFloat scale = request->lowDetail && longestSide > 960 ? 960 / longestSide : 1;
  configuration.width = MAX(1, (NSInteger)ceil(targetWindow.frame.size.width * scale));
  configuration.height = MAX(1, (NSInteger)ceil(targetWindow.frame.size.height * scale));
  [SCScreenshotManager captureImageWithFilter:filter configuration:configuration completionHandler:^(CGImageRef image, NSError *captureError) {
    if (captureError || !image) {
      CaptureWindowFromDisplay(request, targetWindow, content);
      return;
    } else {
      request->image = CGImageRetain(image);
    }
    CompleteWindowCapture(request);
  }];
  [configuration release];
  [filter release];
}

static napi_value CreateCapturePromise(
  napi_env env,
  bool lowDetail,
  bool includeTarget,
  WindowCaptureRequest **request
) {
  *request = new WindowCaptureRequest{
    env, nullptr, nullptr, nullptr, nullptr, nullptr, CGRectZero,
    lowDetail, 0, 0, includeTarget,
  };
  napi_value promise;
  napi_create_promise(env, &(*request)->deferred, &promise);
  napi_value resourceName;
  napi_create_string_utf8(env, "nextclaw-window-capture", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_threadsafe_function(
    env,
    nullptr,
    nullptr,
    resourceName,
    0,
    1,
    nullptr,
    nullptr,
    nullptr,
    ResolveWindowCapture,
    &(*request)->completion
  );
  return promise;
}

static napi_value CaptureWindow(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"windowId is required.");
  uint32_t windowId = 0;
  if (napi_get_value_uint32(env, args[0], &windowId) != napi_ok || windowId == 0) {
    return Throw(env, "host_operation_failed", @"windowId must be a positive integer.");
  }

  const bool lowDetail = argc > 1 && ReadLowDetailOption(env, args[1]);
  WindowCaptureRequest *request = nullptr;
  napi_value promise = CreateCapturePromise(env, lowDetail, false, &request);

  if (@available(macOS 14.0, *)) {
    [SCShareableContent getShareableContentExcludingDesktopWindows:YES onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *content, NSError *error) {
      if (error) {
        request->errorMessage = [@"The target window image is unavailable." retain];
        CompleteWindowCapture(request);
        return;
      }
      SCWindow *targetWindow = nil;
      for (SCWindow *window in content.windows) {
        if (window.windowID == windowId) {
          targetWindow = window;
          break;
        }
      }
      if (!targetWindow) {
        request->errorMessage = [@"The target window image is unavailable." retain];
        CompleteWindowCapture(request);
        return;
      }
      CaptureShareableWindow(request, targetWindow, content);
    }];
  } else {
    request->errorMessage = [@"Native macOS window capture requires macOS 14 or later." retain];
    CompleteWindowCapture(request);
  }
  return promise;
}

static napi_value CaptureApplicationWindow(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"bundleId is required.");
  if (@available(macOS 14.0, *)) {
    // ScreenCaptureKit capture continues below.
  } else {
    return Throw(env, "operation_not_supported", @"Native macOS window capture requires macOS 14 or later.");
  }
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = argc > 1 ? ReadProcessIdentifierOption(env, args[1]) : 0;
  const bool lowDetail = argc > 1 && ReadLowDetailOption(env, args[1]);
  NSRunningApplication *application = ResolveRunningApplication(bundleId, expectedPid);
  if (!application) return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  ActivateApplication(application);
  [NSThread sleepForTimeInterval:0.15];
  WindowCaptureRequest *request = nullptr;
  napi_value promise = CreateCapturePromise(env, lowDetail, true, &request);
  [SCShareableContent getShareableContentExcludingDesktopWindows:YES onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *content, NSError *error) {
    if (error) {
      request->errorMessage = [(error.localizedDescription ?: @"No capturable target window was found.") retain];
      CompleteWindowCapture(request);
      return;
    }
    const pid_t frontmostPid = NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
    SCWindow *bestWindow = nil;
    double bestScore = -1;
    for (SCWindow *window in content.windows) {
      SCRunningApplication *owner = window.owningApplication;
      if (!owner || ![owner.bundleIdentifier isEqualToString:bundleId]) continue;
      if (expectedPid > 0 && owner.processID != expectedPid) continue;
      const double width = window.frame.size.width;
      const double height = window.frame.size.height;
      if (width < 100 || height < 100) continue;
      const double score = width * height + (owner.processID == frontmostPid ? 1000000000000.0 : 0);
      if (score <= bestScore) continue;
      bestScore = score;
      bestWindow = window;
    }
    if (!bestWindow) {
      request->errorMessage = [@"No capturable target window was found." retain];
      CompleteWindowCapture(request);
      return;
    }
    CaptureShareableWindow(request, bestWindow, content);
  }];
  return promise;
}

static napi_value ResolveApplication(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"bundleId is required.");
  NSString *bundleId = ReadString(env, args[0]);
  NSRunningApplication *application = ResolveRunningApplication(bundleId);
  if (!application) {
    napi_value nullValue;
    napi_get_null(env, &nullValue);
    return nullValue;
  }
  napi_value result;
  napi_create_object(env, &result);
  Set(env, result, "bundleId", JsString(env, bundleId));
  Set(env, result, "pid", JsNumber(env, application.processIdentifier));
  Set(env, result, "name", JsString(env, application.localizedName ?: bundleId));
  return result;
}

static napi_value Snapshot(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"bundleId is required.");
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = argc > 1 ? ReadProcessIdentifierOption(env, args[1]) : 0;
  NSRunningApplication *application = ResolveRunningApplication(bundleId, expectedPid);
  if (!application) return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  int maxDepth = argc > 1 ? ReadIntegerOption(env, args[1], "maxDepth", 12) : 12;
  int maxNodes = argc > 1 ? ReadIntegerOption(env, args[1], "maxNodes", 5000) : 5000;
  AXUIElementRef appElement = AXUIElementCreateApplication(application.processIdentifier);
  CFMutableSetRef visited = CFSetCreateMutable(
    kCFAllocatorDefault,
    0,
    &kCFTypeSetCallBacks
  );
  int count = 0;
  napi_value result = SnapshotElement(
    env,
    appElement,
    0,
    maxDepth,
    maxNodes,
    &count,
    visited
  );
  CFRelease(visited);
  CFRelease(appElement);
  return result;
}

static AXUIElementRef ResolvePath(AXUIElementRef root, napi_env env, napi_value path) {
  uint32_t length = 0;
  napi_get_array_length(env, path, &length);
  AXUIElementRef current = (AXUIElementRef)CFRetain(root);
  for (uint32_t pathIndex = 0; pathIndex < length; pathIndex++) {
    napi_value rawIndex;
    uint32_t childIndex = 0;
    napi_get_element(env, path, pathIndex, &rawIndex);
    napi_get_value_uint32(env, rawIndex, &childIndex);
    CFArrayRef children = CopyTraversalChildren(current);
    if (childIndex >= (uint32_t)CFArrayGetCount(children)) {
      CFRelease(children);
      CFRelease(current);
      return nullptr;
    }
    AXUIElementRef next = (AXUIElementRef)CFRetain(
      CFArrayGetValueAtIndex(children, childIndex)
    );
    CFRelease(children);
    CFRelease(current);
    current = next;
  }
  return current;
}


static void EmitAccessibilityNotification(
  AXObserverRef,
  AXUIElementRef,
  CFStringRef notification,
  void *context
) {
  AccessibilityWatch *watch = static_cast<AccessibilityWatch *>(context);
  if (!watch || !watch->callback) return;
  napi_handle_scope scope;
  if (napi_open_handle_scope(watch->env, &scope) != napi_ok) return;
  napi_value callback;
  napi_value global;
  napi_value payload;
  napi_value ignored;
  if (
    napi_get_reference_value(watch->env, watch->callback, &callback) == napi_ok &&
    napi_get_global(watch->env, &global) == napi_ok &&
    napi_create_object(watch->env, &payload) == napi_ok
  ) {
    Set(
      watch->env,
      payload,
      "notification",
      JsString(watch->env, (__bridge NSString *)notification)
    );
    napi_call_function(watch->env, global, callback, 1, &payload, &ignored);
  }
  napi_close_handle_scope(watch->env, scope);
}

static void AddWatchNotifications(
  AccessibilityWatch *watch,
  AXUIElementRef element,
  int depth,
  CFMutableSetRef visited
) {
  if (
    depth > 24 ||
    watch->elements.size() >= 20000 ||
    CFSetContainsValue(visited, element)
  ) return;
  CFSetAddValue(visited, element);
  watch->elements.push_back((AXUIElementRef)CFRetain(element));
  const CFStringRef notifications[] = {
    kAXValueChangedNotification,
    kAXSelectedChildrenChangedNotification,
    kAXRowCountChangedNotification,
    kAXCreatedNotification,
    kAXUIElementDestroyedNotification,
    kAXLayoutChangedNotification,
    kAXFocusedUIElementChangedNotification,
    kAXFocusedWindowChangedNotification,
    kAXWindowCreatedNotification,
  };
  for (CFStringRef notification : notifications) {
    AXObserverAddNotification(watch->observer, element, notification, watch);
  }
  CFArrayRef children = CopyTraversalChildren(element);
  for (CFIndex index = 0; index < CFArrayGetCount(children); index++) {
    AddWatchNotifications(
      watch,
      (AXUIElementRef)CFArrayGetValueAtIndex(children, index),
      depth + 1,
      visited
    );
  }
  CFRelease(children);
}

static napi_value Observe(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 2) return Throw(env, "host_operation_failed", @"bundleId and callback are required.");
  napi_valuetype callbackType;
  napi_typeof(env, args[1], &callbackType);
  if (callbackType != napi_function) {
    return Throw(env, "host_operation_failed", @"Accessibility observer callback is invalid.");
  }
  NSString *bundleId = ReadString(env, args[0]);
  NSRunningApplication *application = ResolveRunningApplication(bundleId);
  if (!application) {
    return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  }
  AccessibilityWatch *watch = new AccessibilityWatch{
    env,
    nullptr,
    nullptr,
    AXUIElementCreateApplication(application.processIdentifier),
    {},
  };
  if (napi_create_reference(env, args[1], 1, &watch->callback) != napi_ok) {
    ReleaseWatch(watch);
    return Throw(env, "host_operation_failed", @"Accessibility observer callback could not be retained.");
  }
  AXError status = AXObserverCreate(
    application.processIdentifier,
    EmitAccessibilityNotification,
    &watch->observer
  );
  if (status != kAXErrorSuccess || !watch->observer) {
    ReleaseWatch(watch);
    return Throw(env, "host_operation_failed", @"macOS AXObserver could not be created.");
  }
  CFMutableSetRef visited = CFSetCreateMutable(
    kCFAllocatorDefault,
    0,
    &kCFTypeSetCallBacks
  );
  AddWatchNotifications(watch, watch->application, 0, visited);
  CFRelease(visited);
  CFRunLoopSourceRef source = AXObserverGetRunLoopSource(watch->observer);
  CFRunLoopAddSource(CFRunLoopGetMain(), source, kCFRunLoopDefaultMode);
  const std::string watchId = "ax-" + std::to_string(NextWatchId++);
  Watches.emplace(watchId, watch);
  napi_value result;
  napi_create_string_utf8(env, watchId.c_str(), watchId.size(), &result);
  return result;
}

static napi_value Unobserve(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc == 0) return Throw(env, "host_operation_failed", @"watchId is required.");
  NSString *rawWatchId = ReadString(env, args[0]);
  const std::string watchId = rawWatchId.UTF8String ?: "";
  auto found = Watches.find(watchId);
  if (found == Watches.end()) return JsBoolean(env, false);
  AccessibilityWatch *watch = found->second;
  Watches.erase(found);
  ReleaseWatch(watch);
  return JsBoolean(env, true);
}

static napi_value PerformAction(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 2) return Throw(env, "host_operation_failed", @"bundleId and action are required.");
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = ReadProcessIdentifierOption(env, args[1]);
  const int expectedWindowId = ReadWindowIdentifierOption(env, args[1]);
  NSRunningApplication *application = ResolveRunningApplication(bundleId, expectedPid);
  if (!application) return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  FocusWindow(application, expectedWindowId);
  napi_value path;
  napi_value typeValue;
  napi_get_named_property(env, args[1], "path", &path);
  napi_get_named_property(env, args[1], "type", &typeValue);
  NSString *type = ReadString(env, typeValue);
  AXUIElementRef appElement = AXUIElementCreateApplication(application.processIdentifier);
  AXUIElementRef element = ResolvePath(appElement, env, path);
  CFRelease(appElement);
  if (!element) return Throw(env, "element_not_found", @"Accessibility element path is stale.");
  AXError status = kAXErrorActionUnsupported;
  NSString *expectedValue = nil;
  if ([type isEqualToString:@"setValue"]) {
    napi_value value;
    napi_get_named_property(env, args[1], "value", &value);
    NSString *text = ReadString(env, value);
    expectedValue = text;
    status = AXUIElementSetAttributeValue(element, kAXValueAttribute, (__bridge CFTypeRef)text);
  } else if ([type isEqualToString:@"press"]) {
    status = AXUIElementPerformAction(element, kAXPressAction);
  } else if ([type isEqualToString:@"confirm"]) {
    status = AXUIElementPerformAction(element, kAXConfirmAction);
  }
  napi_value result;
  napi_create_object(env, &result);
  Set(env, result, "succeeded", JsBoolean(env, status == kAXErrorSuccess));
  if (expectedValue && status == kAXErrorSuccess) {
    NSString *observedValue = CopyStringAttribute(element, kAXValueAttribute);
    if (observedValue) {
      Set(env, result, "observedValue", JsString(env, observedValue));
      Set(env, result, "verified", JsBoolean(env, [observedValue isEqualToString:expectedValue]));
    } else {
      Set(env, result, "verified", JsBoolean(env, false));
    }
  }
  CFRelease(element);
  return result;
}

static napi_value ClickAt(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 2) return Throw(env, "host_operation_failed", @"bundleId and coordinate are required.");
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = ReadProcessIdentifierOption(env, args[1]);
  const int expectedWindowId = ReadWindowIdentifierOption(env, args[1]);
  NSRunningApplication *application = ResolveRunningApplication(bundleId, expectedPid);
  if (!application) return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  napi_value xValue;
  napi_value yValue;
  napi_get_named_property(env, args[1], "x", &xValue);
  napi_get_named_property(env, args[1], "y", &yValue);
  double x = 0;
  double y = 0;
  if (napi_get_value_double(env, xValue, &x) != napi_ok || napi_get_value_double(env, yValue, &y) != napi_ok) {
    return Throw(env, "host_operation_failed", @"Pointer coordinates are invalid.");
  }
  FocusWindow(application, expectedWindowId);
  CGPoint point = CGPointMake(x, y);
  CGEventRef down = CGEventCreateMouseEvent(nullptr, kCGEventLeftMouseDown, point, kCGMouseButtonLeft);
  CGEventRef up = CGEventCreateMouseEvent(nullptr, kCGEventLeftMouseUp, point, kCGMouseButtonLeft);
  if (!down || !up) {
    if (down) CFRelease(down);
    if (up) CFRelease(up);
    return Throw(env, "host_operation_failed", @"Pointer event could not be created.");
  }
  CGEventPost(kCGHIDEventTap, down);
  CGEventPost(kCGHIDEventTap, up);
  CFRelease(down);
  CFRelease(up);
  napi_value result;
  napi_create_object(env, &result);
  Set(env, result, "succeeded", JsBoolean(env, true));
  return result;
}

static bool InjectUnicodeText(NSString *text) {
  const NSUInteger length = text.length;
  if (length == 0) return false;
  std::vector<UniChar> characters(length);
  [text getCharacters:characters.data() range:NSMakeRange(0, length)];
  constexpr NSUInteger MaxUnitsPerEvent = 20;
  for (NSUInteger start = 0; start < length; start += MaxUnitsPerEvent) {
    const NSUInteger count = MIN(MaxUnitsPerEvent, length - start);
    CGEventRef keyDown = CGEventCreateKeyboardEvent(nullptr, 0, true);
    if (!keyDown) return false;
    CGEventKeyboardSetUnicodeString(keyDown, count, characters.data() + start);
    CGEventPost(kCGHIDEventTap, keyDown);
    CFRelease(keyDown);
  }
  return true;
}

static napi_value TypeText(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 2) return Throw(env, "host_operation_failed", @"bundleId and text are required.");
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = ReadProcessIdentifierOption(env, args[1]);
  const int expectedWindowId = ReadWindowIdentifierOption(env, args[1]);
  NSRunningApplication *application = ResolveRunningApplication(bundleId, expectedPid);
  if (!application) return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  FocusWindow(application, expectedWindowId);
  napi_value textValue;
  napi_get_named_property(env, args[1], "text", &textValue);
  NSString *text = ReadString(env, textValue);
  if (text.length == 0) {
    return Throw(env, "operation_not_supported", @"Typing requires non-empty text.");
  }
  // App activation is asynchronous. Let the target finish becoming frontmost
  // before delivering a targeted keyboard event.
  [NSThread sleepForTimeInterval:0.2];
  if (!InjectUnicodeText(text)) {
    return Throw(env, "host_operation_failed", @"Keyboard event could not be created.");
  }
  napi_value result;
  napi_create_object(env, &result);
  Set(env, result, "succeeded", JsBoolean(env, true));
  Set(env, result, "strategy", JsString(env, @"unicode-keyboard-event"));
  return result;
}

static CGKeyCode KeyCodeFor(NSString *key, bool *found) {
  static NSDictionary<NSString *, NSNumber *> *codes = nil;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    codes = [[NSDictionary alloc] initWithDictionary:@{
      @"a": @0, @"s": @1, @"d": @2, @"f": @3, @"h": @4, @"g": @5,
      @"z": @6, @"x": @7, @"c": @8, @"v": @9, @"b": @11, @"q": @12,
      @"w": @13, @"e": @14, @"r": @15, @"y": @16, @"t": @17, @"1": @18,
      @"2": @19, @"3": @20, @"4": @21, @"6": @22, @"5": @23, @"9": @25,
      @"7": @26, @"8": @28, @"0": @29, @"o": @31, @"u": @32, @"i": @34,
      @"p": @35, @"Enter": @36, @"l": @37, @"j": @38, @"k": @40, @"n": @45,
      @"m": @46, @"Tab": @48, @"Space": @49, @"Backspace": @51, @"Delete": @117,
      @"Escape": @53, @"ArrowLeft": @123, @"ArrowRight": @124, @"ArrowDown": @125,
      @"ArrowUp": @126,
    }];
  });
  NSNumber *code = codes[key];
  *found = code != nil;
  return code ? (CGKeyCode)code.unsignedShortValue : 0;
}

static CGEventFlags ReadKeyModifiers(napi_env env, napi_value input, bool *valid) {
  *valid = true;
  bool hasModifiers = false;
  napi_has_named_property(env, input, "modifiers", &hasModifiers);
  if (!hasModifiers) return 0;
  napi_value modifiers;
  napi_get_named_property(env, input, "modifiers", &modifiers);
  bool isArray = false;
  napi_is_array(env, modifiers, &isArray);
  if (!isArray) {
    *valid = false;
    return 0;
  }
  uint32_t length = 0;
  napi_get_array_length(env, modifiers, &length);
  CGEventFlags flags = 0;
  for (uint32_t index = 0; index < length; index += 1) {
    napi_value item;
    napi_get_element(env, modifiers, index, &item);
    NSString *modifier = ReadString(env, item);
    CGEventFlags flag = 0;
    if ([modifier isEqualToString:@"command"]) flag = kCGEventFlagMaskCommand;
    else if ([modifier isEqualToString:@"control"]) flag = kCGEventFlagMaskControl;
    else if ([modifier isEqualToString:@"option"]) flag = kCGEventFlagMaskAlternate;
    else if ([modifier isEqualToString:@"shift"]) flag = kCGEventFlagMaskShift;
    else {
      *valid = false;
      return 0;
    }
    if (flags & flag) {
      *valid = false;
      return 0;
    }
    flags |= flag;
  }
  return flags;
}

static napi_value PressKey(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 2) return Throw(env, "host_operation_failed", @"bundleId and key are required.");
  NSString *bundleId = ReadString(env, args[0]);
  const int expectedPid = ReadProcessIdentifierOption(env, args[1]);
  const int expectedWindowId = ReadWindowIdentifierOption(env, args[1]);
  NSRunningApplication *application = ResolveRunningApplication(bundleId, expectedPid);
  if (!application) return Throw(env, "target_not_running", [NSString stringWithFormat:@"%@ is not running.", bundleId]);
  napi_value keyValue;
  napi_get_named_property(env, args[1], "key", &keyValue);
  NSString *key = ReadString(env, keyValue);
  bool keyFound = false;
  CGKeyCode keyCode = KeyCodeFor(key, &keyFound);
  bool modifiersValid = false;
  CGEventFlags flags = ReadKeyModifiers(env, args[1], &modifiersValid);
  if (!keyFound || !modifiersValid) return Throw(env, "operation_not_supported", @"Keyboard key or modifiers are not supported.");
  FocusWindow(application, expectedWindowId);
  [NSThread sleepForTimeInterval:0.2];
  // The same Unicode-keyboard route backs typeText and is proven to work from
  // the Service worker. Prefer it for printable shortcuts such as Command-F;
  // virtual-key events can require a GUI process initialization path in a
  // worker and must not be allowed to terminate the Host.
  if (key.length == 1) {
    UniChar character = [key characterAtIndex:0];
    CGEventRef down = CGEventCreateKeyboardEvent(nullptr, 0, true);
    if (!down) return Throw(env, "host_operation_failed", @"Keyboard event could not be created.");
    CGEventKeyboardSetUnicodeString(down, 1, &character);
    CGEventSetFlags(down, flags);
    CGEventPost(kCGHIDEventTap, down);
    CFRelease(down);
  } else {
    CGEventRef down = CGEventCreateKeyboardEvent(nullptr, keyCode, true);
    CGEventRef up = CGEventCreateKeyboardEvent(nullptr, keyCode, false);
    if (!down || !up) {
      if (down) CFRelease(down);
      if (up) CFRelease(up);
      return Throw(env, "host_operation_failed", @"Keyboard event could not be created.");
    }
    CGEventSetFlags(down, flags);
    CGEventSetFlags(up, flags);
    CGEventPost(kCGHIDEventTap, down);
    CGEventPost(kCGHIDEventTap, up);
    CFRelease(down);
    CFRelease(up);
  }
  napi_value result;
  napi_create_object(env, &result);
  Set(env, result, "succeeded", JsBoolean(env, true));
  Set(env, result, "strategy", JsString(env, @"key-chord"));
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  // Some applications can stop replying to AX requests. This module runs in
  // the Service-owned desktop worker, so a short process-wide AX timeout keeps
  // one unresponsive target from pinning the worker indefinitely.
  AXUIElementRef systemWideElement = AXUIElementCreateSystemWide();
  if (systemWideElement) {
    AXUIElementSetMessagingTimeout(systemWideElement, AccessibilityMessagingTimeoutSeconds);
    CFRelease(systemWideElement);
  }
  napi_property_descriptor properties[] = {
    { "isTrusted", nullptr, IsTrusted, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "isScreenCaptureTrusted", nullptr, IsScreenCaptureTrusted, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "requestScreenCapturePermission", nullptr, RequestScreenCapturePermission, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "recognizeText", nullptr, RecognizeText, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "resolveApplication", nullptr, ResolveApplication, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "snapshot", nullptr, Snapshot, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "observe", nullptr, Observe, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "unobserve", nullptr, Unobserve, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "performAction", nullptr, PerformAction, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "clickAt", nullptr, ClickAt, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "typeText", nullptr, TypeText, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "pressKey", nullptr, PressKey, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "resolveWindow", nullptr, ResolveWindow, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "resolveCaptureWindow", nullptr, ResolveCaptureWindow, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "captureWindow", nullptr, CaptureWindow, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "captureApplicationWindow", nullptr, CaptureApplicationWindow, nullptr, nullptr, nullptr, napi_default, nullptr },
  };
  napi_define_properties(env, exports, 16, properties);
  napi_add_env_cleanup_hook(env, CleanupWatches, nullptr);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
