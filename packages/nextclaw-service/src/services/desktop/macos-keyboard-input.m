#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

static CGKeyCode KeyCodeFor(NSString *key) {
  static NSDictionary<NSString *, NSNumber *> *codes;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    codes = @{
      @"a": @0, @"s": @1, @"d": @2, @"f": @3, @"h": @4, @"g": @5,
      @"z": @6, @"x": @7, @"c": @8, @"v": @9, @"b": @11, @"q": @12,
      @"w": @13, @"e": @14, @"r": @15, @"y": @16, @"t": @17, @"1": @18,
      @"2": @19, @"3": @20, @"4": @21, @"6": @22, @"5": @23, @"9": @25,
      @"7": @26, @"8": @28, @"0": @29, @"o": @31, @"u": @32, @"i": @34,
      @"p": @35, @"Enter": @36, @"l": @37, @"j": @38, @"k": @40, @"n": @45,
      @"m": @46, @"Tab": @48, @"Space": @49, @"Backspace": @51, @"Delete": @117,
      @"Escape": @53, @"ArrowLeft": @123, @"ArrowRight": @124, @"ArrowDown": @125,
      @"ArrowUp": @126,
    };
  });
  NSNumber *code = codes[key];
  return code ? (CGKeyCode)code.unsignedShortValue : UINT16_MAX;
}

static CGKeyCode ModifierKeyCode(NSString *modifier) {
  if ([modifier isEqualToString:@"command"]) return 55;
  if ([modifier isEqualToString:@"control"]) return 59;
  if ([modifier isEqualToString:@"option"]) return 58;
  if ([modifier isEqualToString:@"shift"]) return 56;
  return UINT16_MAX;
}

static bool PostKey(CGEventSourceRef source, CGKeyCode keyCode, bool down) {
  CGEventRef event = CGEventCreateKeyboardEvent(source, keyCode, down);
  if (!event) return false;
  CGEventPost(kCGHIDEventTap, event);
  CFRelease(event);
  return true;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 5) return 64;
    NSString *bundleId = [NSString stringWithUTF8String:argv[1]];
    NSInteger pid = [[NSString stringWithUTF8String:argv[2]] integerValue];
    NSString *key = [NSString stringWithUTF8String:argv[3]];
    NSString *modifierText = [NSString stringWithUTF8String:argv[4]];
    NSArray<NSString *> *modifiers = modifierText.length ? [modifierText componentsSeparatedByString:@","] : @[];
    CGKeyCode keyCode = KeyCodeFor(key);
    NSRunningApplication *application = [NSRunningApplication runningApplicationWithProcessIdentifier:(pid_t)pid];
    if (keyCode == UINT16_MAX || !application || ![application.bundleIdentifier isEqualToString:bundleId]) return 65;
    if (![application activateWithOptions:0]) return 66;
    [NSThread sleepForTimeInterval:0.2];
    if (!CGPreflightPostEventAccess()) return 67;
    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    if (!source) return 68;
    NSMutableArray<NSNumber *> *modifierCodes = [NSMutableArray array];
    for (NSString *modifier in modifiers) {
      CGKeyCode modifierCode = ModifierKeyCode(modifier);
      if (modifierCode == UINT16_MAX || [modifierCodes containsObject:@(modifierCode)]) {
        CFRelease(source);
        return 65;
      }
      [modifierCodes addObject:@(modifierCode)];
    }
    for (NSNumber *modifierCode in modifierCodes) {
      if (!PostKey(source, (CGKeyCode)modifierCode.unsignedShortValue, true)) {
        CFRelease(source);
        return 68;
      }
    }
    const bool posted = PostKey(source, keyCode, true) && PostKey(source, keyCode, false);
    for (NSNumber *modifierCode in [modifierCodes reverseObjectEnumerator]) {
      if (!PostKey(source, (CGKeyCode)modifierCode.unsignedShortValue, false)) {
        CFRelease(source);
        return 68;
      }
    }
    CFRelease(source);
    return posted ? 0 : 68;
  }
}
