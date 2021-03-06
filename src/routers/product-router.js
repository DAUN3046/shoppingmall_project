import { Router } from 'express';
import is from '@sindresorhus/is';
// 폴더에서 import하면, 자동으로 폴더의 index.js에서 가져옴
import { loginRequired, isAdmin } from '../middlewares';
import {
	productService,
	smallCategoryService,
	categoryService,
	reviewService,
} from '../services';
import { upload, s3 } from '../utils/s3';
import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

const productRouter = Router();

// 테스트
productRouter.get('/testtest', async (req, res, next) => {
	try {
		const products = await productService.findAll();
		res.status(200).json({ status: 'ok' });
	} catch (error) {
		next(error);
	}
});

// 판매 최상위 8개 상품 가져오기
productRouter.get('/bestproducts', async (req, res, next) => {
	try {
		const products = await productService.getRank_8_Product();
		res.status(200).json(products);
	} catch (error) {
		next(error);
	}
});

productRouter.post('/carts', async (req, res, next) => {
	try {
		const cartProducts = req.body.cartProducts;
		let existProducts = [];
		for (let i = 0; i < cartProducts.length; i++) {
			const product = await productService.getProductById(cartProducts[i].id);
			if (product) existProducts.push(cartProducts[i]);
		}
		res.status(200).json(existProducts);
	} catch (error) {
		next(error);
	}
});

// 해당 상품의 리뷰 가져오기
productRouter.get('/reviews/:productId', async (req, res, next) => {
	try {
		const { productId } = req.params;
		const product = await productService.findByIdForReview(productId);
		const starRateSum = product.starRateSum;
		const reviewCount = product.reviewCount;
		const reviewList = product.review;
		let findReviewList = [];
		let productStarRate;
		for (let i = 0; i < reviewList.length; i++) {
			findReviewList.push({ _id: reviewList[i] });
		}
		if (starRateSum === 0 || reviewCount === 0 || findReviewList.length === 0) {
			productStarRate = 0;
			const result = { productStarRate, hasReview: 'no' };
			res.status(200).json(result);
		} else {
			productStarRate = (starRateSum / reviewCount).toFixed(1);
			// reviews 는 [{}, {}] 구조
			const reviews = await reviewService.findByIds(findReviewList);
			let sendReviews = [];
			for (let i = 0; i < reviews.length; i++) {
				sendReviews.push({
					comment: reviews[i].comment,
					starRate: reviews[i].starRate,
					createdAt: reviews[i].createdAt,
					author: reviews[i].author.fullName,
				});
			}
			const result = { productStarRate, sendReviews };
			res.status(200).json(result);
		}
	} catch (error) {
		next(error);
	}
});

// 검색으로 상품 가져오기
productRouter.get('/searchproducts', async (req, res, next) => {
	try {
		const page = Number(req.query.page);
		const keyword = req.query.keyword;
		const products = await productService.SearchProducts(keyword, page);
		res.status(200).json(products);
	} catch (error) {
		next(error);
	}
});

// 가장 많이 팔린 순으로 전체 상품 가져오기
productRouter.get('/rankedproducts', async (req, res, next) => {
	try {
		const rankedProducts = await productService.getRankedProducts();
		res.status(200).json(rankedProducts);
	} catch (error) {
		next(error);
	}
});

// 최신 순으로 전체 상품 가져오기, get 으로 ('/api/newestproducts') 주소로 보내면 됨
productRouter.get('/newestproducts', async (req, res, next) => {
	try {
		const newestProducts = await productService.getNewestProducts();
		res.status(200).json(newestProducts);
	} catch (error) {
		next(error);
	}
});

// 최신 순으로 전체 상품 가져오는데, category 실제 이름 populate해서 추가
productRouter.get('/productswithcategory', async (req, res, next) => {
	try {
		const productsWithCategory =
			await productService.getNewestProductsWithCategory();
		res.status(200).json(productsWithCategory);
	} catch (error) {
		next(error);
	}
});

// 카테고리별 최신 상품
productRouter.get('/Categorylatestproduct', async (req, res, next) => {
	try {
		const Bcategorys = await categoryService.getCategories();
		const latestproduct = await productService.Categorylatestproduct(
			Bcategorys,
		);
		res.status(200).json(latestproduct);
	} catch (error) {
		next(error);
	}
});

// productId로 category 이름 가져오기 => 대카테고리/소카테고리 이렇게 가져옴
productRouter.get('/categoryname/:productId', async (req, res, next) => {
	try {
		const { productId } = req.params;
		const categoryName = await productService.getCategoryNameById(productId);
		res.status(200).json(categoryName);
	} catch (error) {
		next(error);
	}
});

// 무한 스크롤을 위한 상품 16개씩 계속 가져오기
productRouter.get('/rankednextproducts', async (req, res, next) => {
	try {
		const page = Number(req.query.page);
		// page가 0이면 skip 없이 16개 가져오기, page가 1이면 16개 skip 후 17부터 32까지 가져옴
		const rankedNextProducts = await productService.getNextProducts(page);
		res.status(200).json(rankedNextProducts);
	} catch (error) {
		next(error);
	}
});

// 무한 스크롤, 최신 상품 16개씩 가져오기
productRouter.get('/newestnextproducts', async (req, res, next) => {
	try {
		const page = Number(req.query.page);
		const newestNextProducts = await productService.getNextNewestProducts(page);
		res.status(200).json(newestNextProducts);
	} catch (error) {
		next(error);
	}
});

// 상품 상세보기
productRouter.get('/product/:productId', async (req, res, next) => {
	try {
		// 여기서 productId 가 product Schema의 shortId임
		const productId = req.params.productId;
		const product = await productService.getProductById(productId);
		res.status(200).json(product);
	} catch (error) {
		next(error);
	}
});

// 카테고리 별 조회 -> /api/productlist
productRouter.get('/productlist/:category', async (req, res, next) => {
	try {
		const category = req.params.category;
		const products = await productService.getProductsByCategory(category);
		res.status(200).json(products);
	} catch (error) {
		next(error);
	}
});

productRouter.post('/checkout', async (req, res, next) => {
	const imgdata = req.body.key;
	console.log(imgdata);

	var params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: imgdata,
	};
	s3.deleteObject(params, function (err, data) {
		if (err) console.log(err, err.stack); // error
		else console.log(data); // deleted
	});
	next();
});

// 상품등록 -> /api/productRegister
productRouter.post(
	'/products',
	// loginRequired,
	// isAdmin,
	upload.single('img'),
	async (req, res, next) => {
		try {
			// Content-Type: application/json 설정을 안 한 경우, 에러를 만들도록 함.
			// application/json 설정을 프론트에서 안 하면, body가 비어 있게 됨.
			// 카테고리를 폼에서 입력했을 거란 가정하에..
			const category = req.body.Scategory;

			// 카테고리 스키마에서 category로 _id 얻어오기
			let getCategory = await smallCategoryService.getCategoryname(category);
			const categoryId = getCategory._id;
			// req (request)의 body 에서 데이터 가져오기

			const { name, price, description, inventory, company } = req.body;
			let imageUrl = '';
			let imageKey = '';
			// image를 S3에 저장
			// 이후 생성된 url을 받아야 함.
			// middleware에서 s3에 저장
			if (req.file) {
				imageUrl = req.file.location;
				imageKey = req.file.key;
				console.log(req.file);
				console.log(imageUrl);
			} else {
				throw new Error('이미지가 없습니다. 이미지를 추가해주세요!');
			}

			// 위 데이터를 product db에 추가하기
			const newProduct = await productService.addProduct({
				category: categoryId, // 추후 카테고리 스키마에서 카테고리 id 얻어오기,
				name,
				price,
				imageUrl,
				description,
				inventory,
				company,
				imageKey,
			});

			// 추가된 상품의 db 데이터를 프론트에 다시 보내줌
			// 물론 프론트에서 안 쓸 수도 있지만, 편의상 일단 보내 줌
			res.status(201).json(newProduct);
		} catch (error) {
			next(error);
		}
	},
);

// 상품 수정
productRouter.patch(
	'/products/:productId',
	loginRequired,
	isAdmin,
	upload.single('img'),
	async function (req, res, next) {
		try {
			// content-type 을 application/json 로 프론트에서
			// 설정 안 하고 요청하면, body가 비어 있게 됨.
			if (is.emptyObject(req.body)) {
				throw new Error(
					'headers의 Content-Type을 application/json으로 설정해주세요',
				);
			}
			const { productId } = req.params;
			// 카테고리를 폼에서 입력했을 거란 가정하에..
			const category = req.body.Scategory;

			// 카테고리 스키마에서 category로 _id 얻어오기
			let getCategory = await smallCategoryService.getCategoryname(category);
			const categoryId = getCategory._id;
			// req (request)의 body 에서 데이터 가져오기

			const { name, price, description, inventory, company } = req.body;

			let imageUrl = '';
			let imageKey = '';
			// image를 S3에 저장
			// 이후 생성된 url을 받아야 함.
			// middleware에서 s3에 저장
			if (req.file) {
				imageUrl = req.file.location;
				imageKey = req.file.key;
				console.log(req.file);
				console.log(imageUrl);
			}

			const toUpdate = {
				...(categoryId && { category: categoryId }),
				...(name && { name }),
				...(price && { price }),
				...(imageUrl && { imageUrl }),
				...(imageKey && { imageKey }),
				...(description && { description }),
				...(company && { company }),
				...(inventory && { inventory }),
			};
			const updatedProductInfo = await productService.setProduct(
				productId,
				toUpdate,
			);
			if (req.file) {
				// s3에서 이미지 삭제
				const imgKey = req.body.imageKey;
				console.log(imgKey);

				var params = {
					Bucket: process.env.AWS_BUCKET_NAME,
					Key: imgKey,
				};
				s3.deleteObject(params, function (err, data) {
					if (err) {
						console.log(err, err.stack); // error
						res.status(200).json({ updatedProductInfo, status: 'no' });
					} else {
						console.log(data); // deleted
						res.status(200).json({ updatedProductInfo, status: 'ok' });
					}
				});
			} else {
				res.status(200).json(updatedProductInfo);
			}
		} catch (error) {
			next(error);
		}
	},
);

// 상품 삭제
productRouter.delete(
	'/products',
	loginRequired,
	isAdmin,
	async function (req, res, next) {
		try {
			// content-type 을 application/json 로 프론트에서
			// 설정 안 하고 요청하면, body가 비어 있게 됨.
			if (is.emptyObject(req.headers)) {
				throw new Error(
					'headers의 Content-Type을 application/json으로 설정해주세요',
				);
			}

			// front에서 이렇게 줄 것이라 예상 -> shortId로
			const productId = req.body.productId;

			// DB에서 상품 삭제
			await productService.deleteProductByProductId(productId);

			// s3에서 이미지 삭제
			const imgKey = req.body.imageKey;
			console.log(imgKey);

			var params = {
				Bucket: process.env.AWS_BUCKET_NAME,
				Key: imgKey,
			};
			s3.deleteObject(params, function (err, data) {
				if (err) {
					console.log(err, err.stack); // error
					res.status(200).json({ status: 'no' });
				} else {
					console.log(data); // deleted
					res.status(200).json({ status: 'ok' });
				}
				// if (err) console.log(err, err.stack); // error
				// else console.log(data); // deleted
			});

			// res.status(200).json({ status: 'ok' });
		} catch (error) {
			next(error);
		}
	},
);

// 카테고리별 상품 수집
productRouter.get('/categorynext8products/:id', async (req, res, next) => {
	const category_name = req.params.id;
	const page = Number(req.query.page);
	let isSmallcategory = await smallCategoryService.getCategoryname(
		category_name,
	);
	let CategoryProducts;
	if (isSmallcategory == null) {
		let isBigcategory = await smallCategoryService.getbCategoryname(
			category_name,
		);
		CategoryProducts = await productService.BgetCategoryOne(
			isBigcategory,
			page,
		);
	} else {
		isSmallcategory = isSmallcategory._id;
		CategoryProducts = await productService.SgetCategoryOne(
			isSmallcategory,
			page,
		);
	}
	res.status(200).json(CategoryProducts);
});

productRouter.delete('/allproducts', async (req, res, next) => {
	try {
		await productService.deleteAllProducts();
		res.status(200).json({ status: 'ok' });
	} catch (error) {
		next(error);
	}
});

export { productRouter };
