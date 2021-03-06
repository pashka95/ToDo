import dbDriver from '../drivers/dbDriver';
import passwordHash from 'password-hash';
import jwt from 'jsonwebtoken';

const userDriver = new dbDriver('userModel');

class User {

	isCorrectLength(field, min, max) {

		return !(field.length < min || field.length > max);
		
	}
	
	isUniqueField(field, value) {

		return new Promise((resolve, reject) => {

			let criteria = { };

			criteria[field] = value;

			userDriver.readByCriteria(criteria)
				.then((user) => {

					if (user.length == 0) {

						resolve({ answer: true, user });

					} else {
						
						resolve({ answer: false, user });

					}

				})

				.catch((err) => {

					reject(err);

				});

		});

	}
	
	isEqualPasswords(password, confirmPassword) {

		return password === confirmPassword;

	}

	isValidUser(user) {

		return new Promise((resolve, reject) => {

			if (!this.isCorrectLength(user.login, 2, 15)) {

				reject('Поле логин должно быть в диапазоне [2;15]');

			} else if (!this.isCorrectLength(user.password, 6, 20)) {

				reject('Поле пароль должно быть в диапазоне [6;20]');

			} else if (!this.isEqualPasswords(user.password, user.confirm_password)) {

				reject('Пароль не равен подтвержденному паролю');

			} else {

				this.isUniqueField('login', user.login)
					.then((result) => {

						if (!result.answer) {

							reject('Пользователь с даным логином уже существует!');

						} else {

							resolve();

						}

					});

			}

		});

	}

	create(user) {

		return new Promise((resolve, reject) => {

			this.isValidUser(user)
				.then(() => {

					user.token = this.createToken(user.login);
					user.expired = this.createExpired();
					user.password = this.hashPassword(user.password);

					userDriver.createField(user)
						.then((user) => {

							resolve(user);

						})
						.catch((err) => {

							reject({ err, status: 400 });

						});

				})
				.catch((err) => {
					
					reject({ err, status: 400 });

				});

		});

	}

	createToken(login) {

		return jwt.sign(login, 'pashka_super_secret');

	}

	createExpired() {

		return Date.now() + 24 * 60 * 60 * 1000;

	}

	hashPassword(password) {

		return passwordHash.generate(password);
		
	}
	
	isAuthorized(token, id) {

		return new Promise((resolve, reject) => {

			if (!token) {

				console.log('Токен не передан');
				resolve({ answer: false, err: 'Токен не передан' });

			} else {

				this.isUniqueField('token', token)
					.then((result) => {

						if (result.answer) {

							console.log('Токен не найден в БД');
							resolve({ answer: false, err: 'Токен не найден в БД' });

						} else if (Date.now() > result.user[0].expired) {

							console.log('Время истекло');
							resolve({ answer: false, err: 'Время истекло' });

						} else if (id && +(id) !== result.user[0]._id) {

							console.log('Вы не имеете права доступа');
							resolve({ answer: false, err: 'Вы не имеете права доступа' });

						} else {

							resolve({ answer: true, userId: result.user[0]._id });

						}

					})
					.catch((err) => {

						reject(err);

					});

			}

		});
		
	}

	readUser(token, id) {

		return new Promise((resolve, reject) => {

			this.isAuthorized(token)
				.then((result) => {

					if (result.answer) {

						userDriver.readByCriteria({ _id: +(id) })
							.then((user) => {

								resolve(user);

							})
							.catch((err) => {

								reject({ err, status: 400 });

							});

					} else {

						reject({ err: result.err, status: 401 });

					}

				});


		});
	
	}
	
	readAllUser(token) {

		return new Promise((resolve, reject) => {

			this.isAuthorized(token)
				.then((result) => {

					if (result.answer) {

						userDriver.readAll()
							.then((user) => {
								
								resolve(user);

							})
							.catch((err) => {

								reject({ err, status: 400 });

							});

					} else {

						reject({ err: result.err, status: 401 });

					}

				});


		});
		
	}
	
	updateUser(id, user, token) {

		return new Promise((resolve, reject) => {

			this.isAuthorized(token, id)
				.then((result) => {

					if (result.answer) {

						userDriver.updateField(id, user)
							.then(() => {

								resolve();

							})
							.catch((err) => {

								reject({ err, status: 400 });

							});

					} else {

						reject({ err: result.err, status: 401 });

					}

				});


		});
		
	}

	deleteUser(id, token) {

		return new Promise((resolve, reject) => {

			this.isAuthorized(token, id)
				.then((result) => {

					if (result.answer) {

						userDriver.deleteField(id)
							.then(() => {

								resolve();

							})
							.catch((err) => {

								reject({ err, status: 400 });

							});

					} else {

						reject({ err: result.err, status: 401 });

					}

				});


		});

	}

	logIn(login, password) {

		return new Promise((resolve, reject) => {

			userDriver.readByCriteria({ login }).then((user) => {

					if (user.length === 0) {

						reject({ err: 'Неверный логин', status: 400 });

					} else if (!passwordHash.verify(password, user[0].password)) {

						reject({ err: 'Неверный пароль', status: 400 });

					} else {

						let token = this.createToken(login);
						let expired = this.createExpired();

						userDriver.updateField(user[0]._id, { token, expired })
							.then(() => {

								resolve(token);

							})
							.catch((err) => {
								
								reject({ err, status: 400 });
								
							});

					}

				})
				.catch((err) => {

					reject(err, 400);
					
				});

		});

	}

}

export default new User();
