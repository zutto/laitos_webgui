package main

import (
	"fmt"
	"github.com/tdewolff/minify"
	"github.com/tdewolff/minify/css"
	"github.com/tdewolff/minify/html"
	"github.com/tdewolff/minify/js"
	"github.com/tdewolff/minify/json"
	"github.com/zutto/zlog/zl"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"time"
)

var targetDir = "compiled"
var base = ""

var m *minify.M

type parser struct {
	targetFile   string
	sourceFolder string
}

func main() {
	log := zl.GenericLog{}

	if len(os.Args) > 1 {
		curd, err := filepath.Abs(filepath.Dir(os.Args[1]))
		if err != nil {
			panic("Failed to get executable dir")
		}

		base = curd + "/"
	} else {
		base = "./"
	}
	targetDir = base + targetDir

	/*
		list of sources & targets
	*/
	x := map[string]parser{
		"text/javascript":  {targetFile: "scripts.js", sourceFolder: base + "js"},
		"text/css":         {targetFile: "styles.css", sourceFolder: base + "css"},
		"text/html":        {targetFile: "index.html", sourceFolder: base + "html"},
		"application/json": {targetFile: "manifest.json", sourceFolder: base + "json"}}

	m = minify.New()

	m.AddFunc("text/css", css.Minify)
	m.AddFuncRegexp(regexp.MustCompile("[/+]json$"), json.Minify)
	m.AddFunc("text/javascript", js.Minify)
	m.Add("text/html", &html.Minifier{
		KeepDocumentTags:    true,
		KeepDefaultAttrVals: true,
	})

	rpinger := make(chan bool)

	for tyyppi, value := range x {
		log.Write("Compiling from: %s - Type: %s", value.sourceFolder, tyyppi)

		channel := make(chan []byte)

		go writeBuffer(channel, tyyppi, value.targetFile, rpinger, &log)
		go readDir(value.sourceFolder, channel, &log)

	}

	var pingCount int = 0
	for range rpinger {
		pingCount++
		if pingCount >= len(x) {
			os.Exit(1)
		}
	}
}

func writeBuffer(ch chan []byte, mediaType string, t string, done chan bool, log zl.Log) {
	log.Write("writer up for %s", mediaType)
	file, err := os.OpenFile(fmt.Sprintf("%s/%s", targetDir, t), os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	defer func() {
		file.Sync()
		file.Close()
		done <- true //done
	}()

	if err != nil {
		panic("Failed to open file!")
	}

	for i := range ch {
		data, err := m.Bytes(mediaType, i)
		if err != nil {
			panic(fmt.Sprintf("Failed to minify! %s %s", mediaType, err))
		}
		_, writeErr := file.Write(data)
		if writeErr != nil {
			panic(fmt.Sprintf("writing to file failed! %v", writeErr))
		}

	}
}

func readDir(directory string, c chan []byte, log zl.Log) {
	var start int64 = time.Now().UnixNano()

	files, readErr := ReadDirNumSort(directory, false)

	if readErr != nil {
		panic("Readdir failed!")
	}

	defer func() {
		log.Write("Finished scanning %s - took %d MS", directory, ((time.Now().UnixNano() - start) / int64(time.Millisecond)))
		close(c)
	}()

	for _, f := range files {
		d, err := ioutil.ReadFile(fmt.Sprintf("%s/%s", directory, f.Name()))
		log.Write("minimifying file: %s", f.Name())
		if err != nil {
			panic(fmt.Sprintf("%s - %v", "Failed to read file!", fmt.Sprintf("%s/%s", directory, f.Name)))
		}
		c <- d
	}

}

/*
// Taken from https://golang.org/src/io/ioutil/ioutil.go
// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
//
// Modified Sort method to use Numerically sorted names instead.
// It also allows reverse sorting.

credits to: DavicG on SO http://stackoverflow.com/a/37442028
*/

func ReadDirNumSort(dirname string, reverse bool) ([]os.FileInfo, error) {
	f, err := os.Open(dirname)
	if err != nil {
		return nil, err
	}
	list, err := f.Readdir(-1)
	f.Close()
	if err != nil {
		return nil, err
	}
	if reverse {
		sort.Sort(sort.Reverse(byName(list)))
	} else {
		sort.Sort(byName(list))
	}
	return list, nil
}

// byName implements sort.Interface.
type byName []os.FileInfo

func (f byName) Len() int      { return len(f) }
func (f byName) Swap(i, j int) { f[i], f[j] = f[j], f[i] }
func (f byName) Less(i, j int) bool {
	nai, err := strconv.Atoi(f[i].Name())
	if err != nil {
		return f[i].Name() < f[j].Name()
	}
	naj, err := strconv.Atoi(f[j].Name())
	if err != nil {
		return f[i].Name() < f[j].Name()
	}
	return nai < naj
}
