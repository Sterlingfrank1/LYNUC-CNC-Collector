# Makefile for CNC Controller Bridge
#
# Build instructions for the 32-bit C bridge library

CC = gcc
CFLAGS = -m32 -shared -fPIC -Wall -Wextra -O2
LDFLAGS = -lRemoteComm -lpthread -ldl
INCLUDES = -I.

SRC = src/cnc_bridge.c
OUT = lib/libcnc_bridge.so

.PHONY: all clean test test64

# Default target - build 32-bit bridge
all: $(OUT)

$(OUT): $(SRC)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

# Build 64-bit version for testing without 32-bit library
test64: CFLAGS = -shared -fPIC -Wall -Wextra -O2 -DTEST_MOCK
test64: LDFLAGS = -lpthread -ldl
test64: $(SRC)
	$(CC) $(CFLAGS) $(LDFLAGS) -o lib/libcnc_bridge_test64.so $<

# Clean build artifacts
clean:
	rm -f $(OUT) lib/*.so lib/*.o

# Install to Node-RED modules directory
PREFIX ?= ~/.node-red/node_modules/node-red-contrib-cnc-controller

install: $(OUT)
	install -D $(OUT) $(PREFIX)/lib/libcnc_bridge.so

# Show build info
info:
	@echo "Build configuration:"
	@echo "  CC: $(CC)"
	@echo "  CFLAGS: $(CFLAGS)"
	@echo "  LDFLAGS: $(LDFLAGS)"
	@echo "  Source: $(SRC)"
	@echo "  Output: $(OUT)"
	@uname -m
