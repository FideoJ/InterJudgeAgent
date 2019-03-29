```
curl -X POS  \
  http://localhost:1212/judge \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -d '{
	"sub_id": 123,
  "prob_id": 1024,
	"file_provider": "cool",
	"src_filename": ["echo.cpp"],
	"header_filename": [],
	"test_case_id": [1, 2, 3],
	"max_cpu_time": 1000,
	"max_memory": 1048576
}
'
curl http://localhost:1212/judge?sub_id=123
curl -X DELE E \
  'http://localhost:1212/judge?sub_id=123'

{
  "overview": {
    "completed": true,
    "start_time": "2019-03-27 07:24:32.157",
    "end_time": "2019-03-27 07:25:35.157",
    "result": "WRONG_ANSWER"
  },
  "compiler_gpp": {
    "completed": true,
    "start_time": "2019-03-27 07:24:32.157",
    "end_time": "2019-03-27 07:24:35.157",
    "result": "SUCCESS",
    "detail": ""
  },
  "tester": {
    "completed": true,
    "start_time": "2019-03-27 07:25:32.157",
    "end_time": "2019-03-27 07:25:35.157",
    "test_case": [{
        "cpu_time": 500,
        "result": "SUCCESS",
        "memory": 12836864,
        "real_time": 600,
        "signal": 0,
        "exit_code": 0,
        "test_case_id": 1
      },
      {
        "cpu_time": 500,
        "result": "WRONG_ANSWER",
        "memory": 12836864,
        "real_time": 600,
        "signal": 0,
        "exit_code": 0,
        "test_case_id": 2
      }
    ]
  },
  "file_provider": {
    "client": "cool",
    "compiler_gpp": "cool",
    "tester": "cool"
  },
  "origin_req": {
    "sub_id": 123,
    "prob_id": 1024,
    "provider_name": "cool",
    "src_filename": ["echo.cpp"],
    "header_filename": [],
    "test_case_id": [1, 2, 3],
    "max_cpu_time": 1000,
    "max_memory": 1048576
  }
}
```