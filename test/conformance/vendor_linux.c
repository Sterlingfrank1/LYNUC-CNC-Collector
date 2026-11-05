/*
 * 调用厂商 32 位 libRemoteComm.so，结果以 JSON 输出到 stdout。由 run.js 驱动。
 *
 *   gcc -m32 -o vendor_linux vendor_linux.c -ldl
 *   ./vendor_linux <libRemoteComm.so 路径>
 */
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>

typedef int (*connect_fn)(const char *);
typedef void (*close_fn)(int);
typedef int (*macro_fn)(int, int, double *);
typedef int (*plc_fn)(int, const char *, int, unsigned long *);
typedef int (*text_fn)(int, char *);
typedef int (*text_ch_fn)(int, int, char *);
typedef int (*lines_fn)(int, int, int *);
typedef int (*coord_fn)(int, int, double *);

static void *lib;
static int first = 1;

static void *need(const char *name) {
    void *symbol = dlsym(lib, name);
    if (!symbol) {
        fprintf(stderr, "missing symbol %s\n", name);
    }
    return symbol;
}

static void comma(void) {
    if (!first) {
        printf(",");
    }
    first = 0;
}

static void emit_number(const char *name, int rc, double value) {
    comma();
    if (value != value) {
        printf("{\"case\":\"%s\",\"rc\":%d,\"value\":null}", name, rc);
    } else {
        printf("{\"case\":\"%s\",\"rc\":%d,\"value\":%.17g}", name, rc, value);
    }
}

static void emit_text(const char *name, int rc, const char *text) {
    comma();
    printf("{\"case\":\"%s\",\"rc\":%d,\"hex\":\"", name, rc);
    for (; *text; text++) {
        printf("%02x", (unsigned char)*text);
    }
    printf("\"}");
}

int main(int argc, char **argv) {
    static char buffer[4096];
    double value;
    unsigned long plc_value;
    int line_count;
    int handle, rc;
    double coords[9];
    double nan_value = 0.0 / 0.0;

    if (argc < 2 || !(lib = dlopen(argv[1], RTLD_NOW))) {
        fprintf(stderr, "dlopen failed: %s\n", dlerror());
        return 2;
    }

    connect_fn new_connect = (connect_fn)need("remote_new_connect");
    close_fn remote_close = (close_fn)need("remote_close");
    macro_fn read_macro = (macro_fn)need("remote_read_macro_p");
    plc_fn read_plc = (plc_fn)need("remote_read_plc_variable_p_2");
    text_ch_fn cur_file = (text_ch_fn)need("remote_getCurFileName");
    text_fn file_path = (text_fn)need("remote_get_open_file_path");
    lines_fn total_lines = (lines_fn)need("remote_get_CurFileTotalLine");
    text_fn version = (text_fn)need("remote_get_version");
    text_fn serial = (text_fn)need("remote_getMachineSerial");
    text_fn mac = (text_fn)need("remote_getMacAddress");
    text_fn alarms = (text_fn)need("remote_get_errormessage");
    coord_fn absolute = (coord_fn)need("remote_get_AbsolutCoordinate");

    printf("[");
    handle = new_connect("127.0.0.1");
    emit_number("connect", handle >= 0 ? 0 : handle, nan_value);
    if (handle < 0) {
        printf("]\n");
        return 0;
    }

#define MACRO(name, id)                                  \
    value = nan_value;                                   \
    rc = read_macro(handle, id, &value);                 \
    emit_number(name, rc, value)

#define PLC(name, address, type)                         \
    plc_value = 0xFFFFFFFFUL;                            \
    rc = read_plc(handle, address, type, &plc_value);    \
    emit_number(name, rc, (double)plc_value)

#define TEXT(name, call)                                 \
    buffer[0] = 0;                                       \
    rc = call;                                           \
    emit_text(name, rc, buffer)

    MACRO("macro_int", 33505);
    MACRO("macro_float", 30118);
    MACRO("macro_negative", 100);
    PLC("plc_bit", "206.0", 1);
    PLC("plc_field", "205.20.24", 1);
    PLC("plc_mi", "200.1", 0);
    TEXT("file_name", cur_file(handle, 1, buffer));
    TEXT("file_path", file_path(handle, buffer));
    line_count = -1;
    rc = total_lines(handle, 1, &line_count);
    emit_number("total_lines", rc, line_count);
    TEXT("version", version(handle, buffer));
    TEXT("serial", serial(handle, buffer));
    TEXT("mac", mac(handle, buffer));
    TEXT("alarms", alarms(handle, buffer));

    /* Linux 库的坐标接口是空实现：返回 0、不写数据。这里记录下来作为证据。 */
    for (rc = 0; rc < 9; rc++) {
        coords[rc] = -12345.0;
    }
    rc = absolute(handle, 111000000, coords);
    emit_number("stub_absolute", rc, coords[0]);

    remote_close(handle);
    printf("]\n");
    return 0;
}
