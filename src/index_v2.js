const uploadedName = 'nextcloud'
const axios = require('axios');

module.exports = (ctx) => {
  const register = () => {
    ctx.helper.uploader.register(uploadedName, {
      handle: uploader,
      name: 'NextCloud图床',
      config: config
    })

    ctx.on('remove', onRemove)
  }

  const mimeTypes = {
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.tiff': 'image/tiff'
  }

  const getPubHeaders = function (fileName, extname) {
    return {
      'OCS-APIREQUEST': 'true',
      'User-Agent': 'PicGo',
      'Accept': 'application/json'
    }
  }

  const getAuth = function (user, password) {
    return {
      'user': user,
      'password': password,
      'sendImmediately': true
    }
  }


  const getUserConfig = function () {
	  
    let userConfig = ctx.getConfig('picBed.nextcloud')

    if (!userConfig) {
      throw new Error('请先配置nextcloud上传参数')
    }
    const host = userConfig.host
    const path = userConfig.path
    const user = userConfig.user
    const password = userConfig.password
	
    userConfig['directUrl'] = `${host}/${user}${encodeURI(path)}/`
    userConfig['baseUrl'] = `${host}/remote.php/dav/files/${user}/${encodeURI(path)}`
    //userConfig['shareUrl'] = `${host}/ocs/v2.php/apps/files_sharing/api/v1/shares`
    userConfig['auth'] = getAuth(user, password)

    return userConfig
  }

  const deleteFile = async function (fileName) {
    let userConfig = getUserConfig()
    let headers = getPubHeaders()
    try {
      await axios({
        method: 'delete',
        url: `${userConfig['baseUrl']}/${encodeURI(fileName)}`,
        auth: userConfig['auth'],
        headers: headers,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      })
      // ctx.emit('notification', {
      //   title: '删除提示',
      //   body: `已删除文件${fileName}`
      // })
    } catch(err) {
      ctx.emit('notification', {
        title: '删除失败',
        body: `${err.message}`
      })
    }
  }

  const onRemove = async function (files) {
    const rms = files.filter(each => each.type === uploadedName)
    if (rms.length === 0) {
      return
    }
    const fail = []
    for (let i = 0; i < rms.length; i++) {
      const each = rms[i]
      let image = rms[i]
      deleteFile(image.fileName).catch((err) => {
        ctx.log.info(JSON.stringify(err))
        fail.push(each)
      })
    }

    if (fail.length) {
      const uploaded = ctx.getConfig('uploaded')
      uploaded.unshift(...fail)
      ctx.saveConfig(uploaded)
    }

    // ctx.emit('notification', {
    //   title: '删除提示',
    //   body: fail.length === 0 ? '成功同步删除' : `删除失败${fail.length}个`
    // })
  }

  const uploader = async function (ctx) {
    let userConfig = getUserConfig();

    try {
		axios.defaults.auth = {
			username: userConfig.user,
			password: userConfig.password};
        let imgList = ctx.output;
        for (let i in imgList) {
            let image = imgList[i];
            let data = image.buffer;
            if (!data && image.base64Image) {
                data = Buffer.from(image.base64Image, 'base64');
            }
            let headers = getPubHeaders();
            const contentType = mimeTypes[image.extname] || 'application/octet-stream';
            
            await axios.put(`${userConfig['baseUrl']}/${encodeURI(image.fileName)}`, data, {
                headers: {
                    ...headers,
                    'Content-Disposition': `attachment; filename="${encodeURI(image.fileName)}"`,
                    'Content-Type': contentType
                },
                https: {
                    minVersion: 'TLSv1.2' // 指定最低支持的TLS版本
                }
            });

            //let body = await axios.post(userConfig['shareUrl'], {
            //    path: `${userConfig.path}/${image.fileName}`,
            //    shareType: 3
            //}, {
            //    headers: headers,
            //    https: {
            //        minVersion: 'TLSv1.2' // 指定最低支持的TLS版本
            //    }
            //});

            delete image.base64Image;
            delete image.buffer;
            body = body.data.ocs;
            if (body.meta.statuscode === 200) {
				image.imgUrl = userConfig.directUrl + image.fileName;
                //image.imgUrl = body.data.url + '/preview';
                ctx.emit('notification', {
                    title: '图片链接已复制！',
                    body: ''
                });
            } else {
                ctx.emit('notification', {
                    title: 'Nextcloud共享失败',
                    body: '请检查Nextcloud设置'
                });
                deleteFile(image.fileName);
            }
        }
    } catch (err) {
        if (err.message.indexOf('404') === 0) {
            ctx.emit('notification', {
                title: '上传失败',
                body: '路径不存在，请检查路径设置'
            });
        } else {
            ctx.emit('notification', {
                title: '上传失败',
                body: err.message
            });
            ctx.log.error('', err);
        }
    }
}
  const config = ctx => {
    let userConfig = ctx.getConfig('picBed.nextcloud')
    if (!userConfig) {
      userConfig = {}
    }
    return [
      {
        name: 'host',
        type: 'input',
        default: userConfig.host,
        required: true,
        message: '服务地址',
        alias: '服务地址'
      },
      {
        name: 'user',
        type: 'input',
        default: userConfig.user,
        required: true,
        message: '用户名',
        alias: '用户名'
      },
      {
        name: 'password',
        type: 'password',
        default: userConfig.password,
        required: true,
        message: '密码',
        alias: '密码'
      },
      {
        name: 'path',
        type: 'input',
        default: userConfig.path,
        required: true,
        message: '自定义保存路径',
        alias: '保存路径'
      }
    ]
  }
  return {
    uploader: 'nextcloud',
    register
  }
}
