#include <jni.h>
#include <cstdlib>
#include <cstring>
#include <vector>
#include <string>
#include "node.h"

// Node's argv must use contiguous writable storage for libuv's process-title handling.
extern "C" JNIEXPORT jint JNICALL
Java_top_izuna_foliamajor_EmbeddedMusic_startNode(JNIEnv* env, jclass, jobjectArray args) {
    int count = env->GetArrayLength(args);
    std::vector<std::string> values;
    size_t size = 0;
    for (int i = 0; i < count; ++i) {
        auto str = (jstring) env->GetObjectArrayElement(args, i);
        const char* value = env->GetStringUTFChars(str, nullptr);
        values.emplace_back(value);
        size += values.back().size() + 1;
        env->ReleaseStringUTFChars(str, value);
        env->DeleteLocalRef(str);
    }
    std::vector<char> buffer(size);
    std::vector<char*> argv(count + 1, nullptr);
    size_t offset = 0;
    for (int i = 0; i < count; ++i) {
        argv[i] = buffer.data() + offset;
        std::memcpy(argv[i], values[i].c_str(), values[i].size() + 1);
        offset += values[i].size() + 1;
    }
    return node::Start(count, argv.data());
}
